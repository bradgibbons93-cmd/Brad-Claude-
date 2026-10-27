# Yumi

A family app for kids' phones: routines, stars, strikes, a private journal, "My week" picks,
the family calendar with Mum's and Dad's houses, jobs, ideas and messages, a private diary for Dad
and games (the KATSEYE word search to start). Each family gets
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
- A diary (`diary/<person>/…`) only ever reaches its writer's own phones: not the girls, not another
  parent, and not anyone else's backup.
- An HQ (`hq/<person>/…`) only ever reaches its owner's phones: not the girls, not another parent.
- A girl's friends (`kids/<id>/friends/…`) reach her and a parent only, never her sister. "Playdate?"
  puts a request on Dad's Waiting for you (`askPlaydate`).
- Dad's own reasons for a star are kept at `settings/starReasons`; the Spend or save rewards he can
  change are `settings/rewards`, which the server also reads for what each costs.
- Games keep progress at `play/<person>/<game>`: the KATSEYE word search, Memory match (eight KATSEYE photo cards in `public/img/katseye/`), seven poster games in `public/js/games2.js`, and Noughts &
  crosses (`public/js/minigames.js`; the noughts & crosses rules and Yumi's moves are in `xo.js`). Everyone can see how far the others got; only you can
  move your own. Games never give stars. The puzzle logic is in `public/js/wordsearch.js` so the unit
  tests can check every word is on the printable and that every shuffle fits all twelve.
- Good & hard days (`kids/<id>/together/<YYYY-MM-DD>`): each girl checks in on how a day went with
  Dad's partner and her kids (great to really hard, or didn't see them, plus what happened). Only she
  writes it; Dad reads it; her sister never receives it. Ticking "I'd like to talk to Dad" puts it on
  his Waiting for you once (`togetherTalk`). The graph and the words under it come from
  `public/js/togethermath.js`: "mostly hard" needs more hard days than good ones across at least three
  different weeks, so one argument can't make it. Who the question is about is `settings/together`.

## HQ and the iPhone widget

A parent's own command centre, on the HQ tab, in the Cel-X Group look: brain dump, the studio,
to-dos, money and subscriptions. It lives at `hq/<person>/<collection>/<id>` (`src/hq.ts`).

- An HQ reaches only its owner's phones: not the girls, and not another parent, since it holds work
  and money. Writes are checked in `rules.ts` like everything else.
- The sums (task order, a month's money, what subscriptions cost) are in `public/js/hqmath.js`, which
  the page, the server and the tests all import, so the page and the widget can't disagree.
- **The widget** is a script for the free Scriptable app (`src/hqscript.ts`). A web app can't have a
  real iPhone widget, and a Scriptable widget can't run code on a tap, only open a link, so every tap
  opens the same script in Scriptable to tick a to-do, add one, start a 25-minute block or show the
  list. It reads `GET /api/hq/w/<key>` and posts to `/task` and `/done`. The key is 32 random bytes
  shown once inside the script; only its SHA-256 is kept. Making a new one, or Turn off, stops older
  copies. Today's events come from the phone's own calendar.
- **The move from the HQ page in Claude**: the HQ page's "Copy for Yumi" puts everything on the
  clipboard and the HQ tab's "Paste from HQ" brings it in for the signed-in parent
  (`POST /api/hq/import-mine`). Claude can do the same from outside with a 30-minute, single-use code
  the parent makes (`POST /api/hq/import-code`, then `POST /api/hq/import`). Either way it only fills
  empty spots, so doing it twice adds nothing twice.
- `test/unit/hqscript.test.ts` runs the widget script in `test/scriptable.ts`, a stand-in for
  Scriptable that throws on anything Scriptable doesn't have, because a typo there is a blank widget
  on the phone. `test/e2e/hq.mjs` drives the whole thing in a phone-sized browser.

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

Lock-screen notifications use Web Push with no extra packages. The server makes its own key pair on
first start (kept in the database), so there's nothing to configure. iPhones need Yumi on the Home
Screen (iOS 16.4+) before notifications can be turned on; the app shows how. Routine reminders go out
at 7:15, 16:00 and 19:30 in the family's time zone, only when steps are left. A girl can turn them off.

Family data, photos and pictures of the family never go in this repository. Pictures arrive
through the import and are served only to phones the family has signed in on.
