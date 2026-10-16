# Yumi

A family app for kids' phones: routines, stars, strikes, a private journal, "My week" picks,
the family calendar with Mum's and Dad's houses, jobs, ideas and messages. Each family gets
its own name under the Yumi brand ("Yumi · <family name>").

It runs as one small Bun server with Postgres, on Railway.

## How it works

- **Server** (`src/`): `server.ts` (routes), `auth.ts` (codes, sessions, "Add a phone"),
  `rules.ts` (who can read and write what), `stars.ts` (the star rules), `importer.ts`
  (one-time data move), `db.ts` (tables, all prefixed `y_`).
- **App** (`public/`): plain JavaScript modules, no build step. Live updates use long-polling
  (`/api/sync`), so a tick on one phone shows on the others within a second or two.
- **Data** is a set of small JSON records with paths like `kids/<id>/log/<id>`. The server only
  sends each phone what its person may see. A girl's phone never receives her sister's room, and
  a journal page only reaches a parent when she shares it.

## Rules the app enforces

- Kids' codes are 4 numbers, the parent code is 6. Codes are hashed and checked on the server.
- A phone stays signed in until someone taps Sign out. Kids can only type their code on a phone
  that's been added before; new phones need a one-time "Add a phone" code from a parent
  (6 characters, 10 minutes).
- Wrong codes: 5 tries then a wait (5 minutes for kids, 15 for a parent, plus a family-wide limit).
- Stars and strikes don't reset weekly. Every 3rd strike takes a star. From strike 10 the girl sees
  that her principal will be told and the parent gets an alert. The app never contacts a school.
- At 100 stars it's payday: $100 from the parent, then the jar and strikes start again
  (anything over 100 carries over). Rewards can be bought with stars before then.
- Finishing the whole routine earns a star; unticking takes it back.

## Running locally

```sh
DATABASE_URL=postgres://user@localhost:5432/yumi SETUP_TOKEN=pick-something bun src/server.ts
# open http://localhost:8080/?setup=pick-something
bun test test/unit
```

## Deploying on Railway

1. New service from this GitHub repo with **Root Directory** `yumi` (it builds the `Dockerfile`).
2. Variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SETUP_TOKEN` = a long random string (used once to make the parent code)
   - Optional, once: `YUMI_IMPORT` (and `YUMI_IMPORT_2`, `_3`…) holding a gzipped, base64 JSON
     export of existing family data. It only fills empty spots and runs once per payload.
     Remove these variables after the first successful start. The same payload can instead be
     sent to `POST /api/import` with `{ "token": SETUP_TOKEN, "payload": "..." }` before setup.
3. Generate a domain, then open `https://<domain>/?setup=<SETUP_TOKEN>`.

Family data, photos and pictures of the family never go in this repository. Pictures arrive
through the import and are served only to phones the family has signed in on.
