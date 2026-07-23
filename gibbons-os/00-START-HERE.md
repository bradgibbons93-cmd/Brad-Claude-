# GIBBONS OS — Start Here

**This folder is the source of truth for Brad's entire system.**
If any AI, app, or person needs to understand how Brad works, they read this folder first.

## What this is

Seven short documents. Not a blueprint package. Not a 12-month roadmap.
If a document in here grows past ~2 pages, it's doing too much — split it or cut it.

| File | What it's for |
|------|---------------|
| `00-START-HERE.md` | This page. The rules. |
| `01-DRIVE-STRUCTURE.md` | The one folder structure, forever. |
| `02-AI-ROUTING.md` | Which AI does which job. |
| `03-FAMILY-REFERENCE.md` | Character sheet template so AIs never get the family wrong. |
| `04-CLIENT-ONBOARDING.md` | Cel-X standard client setup. |
| `05-REMINDERS.md` | The capture + reminder system. |
| `06-WEEK-1.md` | What actually gets finished this week. |

## The five rules

1. **One source of truth.** Google Drive holds the canonical files. This repo holds the system docs (structure, SOPs, prompts). No AI "remembers" anything independently — they all read from here.
2. **Finish before starting.** No new project begins until something on the current list ships. 78 builds and 0 launches is the problem this rule fixes.
3. **Harvest or archive — never rebuild.** (Brad's own rule from the Master Index. It stays.)
4. **Plans max out at one page.** Any AI output longer than a page of planning gets condensed or binned. Deliverables can be long; plans can't.
5. **Kids' documents, legal evidence, and logins never go in GitHub or any AI chat.** They live in Drive (and the legal vault). This repo holds templates and structure only.

## Current priorities (in order)

1. **Stevie Burr video** — committed client work. Finish it.
2. **SOFTR** — the clearest commercial opportunity.
3. **Legal vault** — everything dated, exported, searchable. Maintained weekly, not rebuilt.
4. **Cel-X client system** — standardise once (see `04`), then it runs itself.
5. Everything else (YOOMI, Connect, experimental apps) — **parked**, not deleted. They wait until 1–4 are done.

## The master prompt (paste into a new Claude Project called "Gibbons OS")

> You are the operations brain for Brad Gibbons. The files in this project are the source of truth — folder structure, AI routing, family reference, client SOPs, and current priorities. Your job on every request: (1) answer using these documents, never invent details about Brad's family, clients, or projects; (2) if I ask for something that conflicts with the current priorities in 06-WEEK-1, say so before helping; (3) keep every plan you produce to one page or less; (4) when information is missing, ask one focused question instead of assuming. You are not here to generate new project ideas — you are here to help me finish the ones on the list.
