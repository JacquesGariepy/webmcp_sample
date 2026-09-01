# Reading List: a WebMCP sample, built with tk

A single static page that registers tools for the browser's agent with **WebMCP** (`document.modelContext`), and the complete record of how it was built with **[tk](https://github.com/JacquesGariepy/tk)**, the git-backed execution ledger for teams that ship with coding agents.

- `index.html`, `app.mjs`, `style.css`: the page. No build step, no dependency. Open it from any static server.
- `AGENTS.md`, `.claude/settings.json`: written by `tk setup repo`; they tell every coding agent that opens this repository how to pick up, finish and hand off work through tk.
- `WALKTHROUGH.md`: every tk command run while building this sample, with its real output, and the event log it produced.

## What the page does for an agent

| Tier | Tools | Behaviour |
|---|---|---|
| read | `reading_list_state`, `reading_list_unread` | No side effects (`readOnlyHint`). |
| write | `reading_list_mark_read`, declarative form `reading_list_add` | Immediate, same functions as the buttons. |
| decision | `reading_list_propose_delete` | Never deletes. Creates a proposal under *Needs a person*; you approve or reject. |
| scoped | `reading_list_selected_show`, `…_selected_mark_read`, `…_selected_propose_delete` | Registered when you click an item, unregistered when you click another (`AbortController` → `toolchange`). |

Try it in Chrome with `chrome://flags/#enable-webmcp-testing` or in ChatGPT's in-app browser:

> "Add the WebMCP explainer to my reading list, tag webmcp." → the agent submits the form (`SubmitEvent.agentInvoked`, answered with `respondWith`).
> "What have I not read about agents?" → `reading_list_unread` with `tag: "agents"`.
> "Delete the oldest one." → a proposal appears; nothing is deleted until you click **Approve**.

Without WebMCP the page is an ordinary reading list.

## How tk was used here

The work was tracked in a tk store (a separate git repository) with a project `webmcp` mapped to this repository. Each step below was a tk task: claimed, implemented, committed, closed with `tk done --files --note`, the tracker write computed by tk and left in the outbox for the GitHub CLI to apply.

```
tk add "Reading List: WebMCP sample" --ref 1              # root bound to GitHub issue #1
tk add "scaffold page + styles" --parent <root>
tk add "register read/write/decision tools" --parent <root>
tk add "declarative form + selection-scoped tools" --parent <root>
tk add "README + walkthrough" --parent <root>
tk ready · tk claim · (work, git commit) · tk done --files … --note …   ×4
tk outbox · tk status · tk validate
```

Read `WALKTHROUGH.md` for the unabridged session.

## License

MIT.
