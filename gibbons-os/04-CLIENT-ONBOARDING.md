# 04 — Cel-X Client Onboarding (The one-click workflow)

Every client gets the identical folder and the identical process. No exceptions,
no custom structures. That's what makes it fast.

## The two arms of CEL-X Group

CEL-X Group is the agency umbrella. It has two functional arms, and every piece
of work belongs to one of them:

| Arm | Does | Examples |
|-----|------|----------|
| **Cyph Media** | Creative — video, photography, content production | Stevie Burr music video, client shoots, edited content |
| **CEL-X Digital** | Automation, AI, and tech — brand brains, AI twins, client tech, digital ops | Brand Brain docs, AI Twin/quote automation, CEL-X OS, client websites |

"Client" and "ownership" are separate. The agency services a roster of client
accounts, and that roster includes both outside clients (Kayo Tattoo, Canggu Ink
Club, etc.) **and** Brad's own owned businesses (City Ink Tattoo, and — as a
sibling project rather than a CEL-X client — SOFTR). Owning a business doesn't
exempt it from going through the same brand-brain/onboarding pipeline as a
paying client; it just means Brad is also the client.

When starting new work, name the arm first: *"this is a Cyph Media shoot"* or
*"this is a CEL-X Digital build"* — so the right skillset and the right AI
routing (see `02-AI-ROUTING.md`) get used from the start.

## Standard client folder (create in `04_CEL-X/Clients/<Name>`)

```
<Client Name>
├── 00_Overview.md      (contact details, links, what we're doing for them, status)
├── 01_Brand            (logos, colours, fonts, brand book)
├── 02_Assets           (photos, videos, raw material from client)
├── 03_Content          (posts, captions, scheduled work)
├── 04_Website
├── 05_Money            (proposal, contract, invoices)
└── 06_AI_Brain         (the client brief doc every AI gets fed)
```

## The onboarding prompt (paste into Gibbons OS Claude Project)

> New Cel-X client: **[name]**. Website: **[url]**. Attached: [logos/photos if any].
> Do the standard onboarding:
> 1. Audit their current online presence (site, socials, Google listing) — strengths, gaps, quick wins.
> 2. Draft `00_Overview.md` and the `06_AI_Brain` client brief using the Cel-X template.
> 3. Draft a brand snapshot: voice, colours, audience, competitors.
> 4. Propose a 30-day content plan (posts + captions) and one website improvement list.
> 5. Give me the proposal draft using the Cel-X template.
> Keep each output one page. Ask before assuming anything about pricing.

Mate-with-a-mechanic-business scenario: this prompt + their URL + 20 minutes = onboarded.

## Current clients

Kayo Tattoo · Canggu Ink Club · 58 Clothing · Jake Hanson Building · All Ink Tattoo ·
City Ink · 2KD · Stevie Burr Video · Haste Hygiene · Encapsulator

**Migration rule:** don't reorganise all ten in one sitting. Restructure each client's
folder the next time you actually work on them. Old ones catch up naturally.
