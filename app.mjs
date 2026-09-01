// Reading List: a minimal, dependency-free WebMCP sample (step 2: catalogue tools only; selection-scoped tools come next).
// Three ideas borrowed from tk's board (https://github.com/JacquesGariepy/tk):
//   1. tools in tiers: read (no side effects), write (immediate), decision (a proposal a person approves);
//   2. selection-scoped tools that appear and disappear with the human's attention (toolchange);
//   3. a declarative <form toolname> that the agent can submit with zero JavaScript on our side.
// Without WebMCP the page is a normal UI: nobody is locked out.

const $ = (s) => document.querySelector(s);
const KEY = "reading-list.v1";
const state = { items: load(), selected: null, proposals: [], feed: [] };

// ---------- storage ----------
function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state.items)); } catch {} }
const id = () => Math.random().toString(36).slice(2, 10);
const log = (who, text) => { state.feed.unshift({ at: new Date().toISOString(), who, text }); render(); };

// ---------- domain (the same functions serve clicks and tools) ----------
function addItem({ url, title, tag = "", note = "" }, who) {
  if (!/^https?:\/\//.test(url || "")) throw new Error("url must be absolute (http or https)");
  if (!title?.trim()) throw new Error("title is required");
  const item = { id: id(), url, title: title.trim(), tag: (tag || "").trim().toLowerCase(), note: (note || "").trim(), read: false, added: new Date().toISOString() };
  state.items.unshift(item); save(); log(who, `added "${item.title}"`); return item;
}
function markRead(itemId, read, who) {
  const it = state.items.find(i => i.id === itemId); if (!it) throw new Error(`no item ${itemId}`);
  it.read = read; save(); log(who, `${read ? "marked read" : "marked unread"} "${it.title}"`); return it;
}
function proposeDelete(itemId, reason, who) {
  const it = state.items.find(i => i.id === itemId); if (!it) throw new Error(`no item ${itemId}`);
  const p = { id: id(), itemId, title: it.title, reason: reason || "(no reason given)", by: who, at: new Date().toISOString() };
  state.proposals.push(p); log(who, `proposed deleting "${it.title}": ${p.reason}`); return { proposal: p.id, status: "awaiting a person" };
}
function decide(proposalId, approve) {
  const i = state.proposals.findIndex(p => p.id === proposalId); if (i < 0) return;
  const [p] = state.proposals.splice(i, 1);
  if (approve) { state.items = state.items.filter(x => x.id !== p.itemId); save(); log("you", `approved deleting "${p.title}"`); }
  else log("you", `rejected deleting "${p.title}"`);
}

// ---------- rendering ----------
function render() {
  $("#count").textContent = String(state.items.length);
  $("#items").innerHTML = state.items.map(i => `
    <li class="item ${i.read ? "read" : ""} ${state.selected === i.id ? "selected" : ""}" data-id="${i.id}">
      <label><input type="checkbox" ${i.read ? "checked" : ""} data-toggle="${i.id}"> <a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a></label>
      ${i.tag ? `<span class="tag">${esc(i.tag)}</span>` : ""}
      ${i.note ? `<p class="note">${esc(i.note)}</p>` : ""}
    </li>`).join("") || `<li class="empty">Nothing yet. Add a link, or ask your agent to.</li>`;
  $("#proposals").innerHTML = state.proposals.map(p => `
    <li class="proposal"><b>Delete "${esc(p.title)}"</b> <span class="by">proposed by ${esc(p.by)}</span><p>${esc(p.reason)}</p>
      <button data-approve="${p.id}">Approve</button> <button data-reject="${p.id}" class="ghost">Reject</button></li>`).join("") || `<li class="empty">No pending decision.</li>`;
  $("#feed").innerHTML = state.feed.slice(0, 30).map(f => `<li><time>${f.at.slice(11, 19)}</time> <b>${esc(f.who)}</b> ${esc(f.text)}</li>`).join("");
}
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- clicks (the human path) ----------
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.toggle) return markRead(t.dataset.toggle, t.checked, "you");
  if (t.dataset.approve) return decide(t.dataset.approve, true);
  if (t.dataset.reject) return decide(t.dataset.reject, false);
  const li = t.closest?.("li.item"); if (li && !t.closest("a") && !t.closest("input")) select(li.dataset.id);
});
$("#add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try { addItem(data, "you"); e.target.reset(); } catch (err) { log("page", `rejected: ${err.message}`); }
});

// ---------- WebMCP ----------
const mc = document.modelContext ?? navigator.modelContext ?? null;
const statusEl = $("#webmcp-status");
const registered = new Set();
function tool(def) {
  if (!mc) return;
  registered.add(def.name);
  return mc.registerTool({
    name: def.name, description: def.description, inputSchema: def.input,
    annotations: def.tier === "read" ? { readOnlyHint: true } : def.tier === "decision" ? { destructiveHint: true, title: "proposal only" } : {},
    async execute(input, { signal } = {}) {
      if (signal?.aborted) throw new Error("cancelled");
      try { const r = await def.run(input ?? {}); return { content: [{ type: "text", text: JSON.stringify(r) }] }; }
      catch (err) { log("page", `tool ${def.name} refused: ${err.message}`); return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }], isError: true }; }
    }
  });
}
const obj = (properties, required = []) => ({ type: "object", properties, required });

function registerCatalogue() {
  tool({ name: "reading_list_state", tier: "read", description: "Every item on the reading list with id, title, url, tag, note and read flag, plus pending deletion proposals.", input: obj({}), run: () => ({ items: state.items, proposals: state.proposals }) });
  tool({ name: "reading_list_unread", tier: "read", description: "Items not read yet, optionally filtered by tag.", input: obj({ tag: { type: "string" } }), run: ({ tag }) => state.items.filter(i => !i.read && (!tag || i.tag === tag)) });
  tool({ name: "reading_list_mark_read", tier: "write", description: "Mark an item as read (or unread with read=false).", input: obj({ id: { type: "string" }, read: { type: "boolean", default: true } }, ["id"]), run: ({ id, read = true }) => markRead(id, read, "agent") });
  tool({ name: "reading_list_propose_delete", tier: "decision", description: "Propose deleting an item. Never deletes: a person approves or rejects on the page.", input: obj({ id: { type: "string" }, reason: { type: "string" } }, ["id"]), run: ({ id, reason }) => proposeDelete(id, reason, "agent") });
}

function select(itemId) { state.selected = state.selected === itemId ? null : itemId; render(); }

if (mc) {
  registerCatalogue();
  const api = document.modelContext ? "document.modelContext" : "navigator.modelContext (deprecated name)";
  statusEl.textContent = `WebMCP ${api}: ${registered.size} tools registered`;
  statusEl.classList.add("ok");
} else {
  statusEl.textContent = "WebMCP not available in this browser: the page works by hand. Chrome: chrome://flags/#enable-webmcp-testing";
  statusEl.classList.add("off");
}
render();
