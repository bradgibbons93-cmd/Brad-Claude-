# 02 — AI Routing (Which tool owns which job)

One tool per job. If two tools are doing the same job, one of them stops.

| Job | Owner | Notes |
|-----|-------|-------|
| Source of truth / thinking partner | **Claude Project "Gibbons OS"** | Holds these docs. Every planning conversation starts here. |
| Building & shipping code | **Claude Code** | Repos, sites, automations. It builds; it doesn't decide strategy. |
| Images, video, motion, animations | **Higgsfield** | Logo animations, hero videos, client content. Creative output only. |
| Quick brainstorms / second opinion | **ChatGPT** | Fine for ideas. Its plans do NOT become the plan — Gibbons OS decides. |
| Long-term memory across tools | **Supermemory** | Feed it the same docs from this folder, nothing extra. |
| Automations / integrations | **Zapier or Make** (pick ONE) | New-client workflow, reminder pipelines. |
| Client sites (simple) | **Higgsfield websites / Lovable** | Only after brand assets exist. |
| Canonical file storage | **Google Drive** | See 01-DRIVE-STRUCTURE.md. |

## Which Claude model

- **Sonnet** — default. Drafting, sorting, summaries, everyday questions.
- **Fable/Opus** — big-picture synthesis, hard architecture, legal document analysis, anything where being wrong is expensive.
- Rule of thumb: if the task fits in one message, Sonnet. If it needs the whole picture, Fable.

## Where output gets saved (so nothing evaporates)

1. Client deliverable → that client's Drive folder.
2. Reusable system/prompt/SOP → this repo (`gibbons-os/`).
3. One-off chat worth keeping → `99_ARCHIVE/AI Exports` in Drive.
4. Everything else → nowhere. Let it go.

## The "don't do this" list

- Don't ask three AIs the same question and merge the answers — pick the owner, use its answer.
- Don't let any AI "remember" family or client facts from chat — it reads the reference sheets instead.
- Don't start a build in a tool because the tool is exciting. Job first, tool second.
