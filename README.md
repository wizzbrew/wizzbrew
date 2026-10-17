# Wizzbrew

A Discord bot for SpeedGaming Live 2026. Ask it about the schedule, streams, standings and
players, or how things work. It answers from [Wizzrobe](https://onsite.speedgaming.org), the
event's onsite tool. Link your Wizzrobe account and it can also do a few things for you: sign you
up as crew, acknowledge a match, offer a match for stream.

## How people talk to it

- **Mentions.** @mention the bot in an allowed channel and ask in plain words.
- **Replies.** Reply to one of its messages to follow up. Anyone can follow up on a public answer.
- **DMs.** Message it directly; it answers there. The channel is the normal place to ask, so each
  person gets a few DM questions a day (`DM_DAILY_LIMIT`, default 5), then a line pointing back to
  the channel.
- **Slash commands.** `/ask`, `/schedule`, `/live`, `/standings`, `/player`, `/link`, `/unlink`,
  `/me`, `/help`. `/help` is a static private overview; it makes no model or Wizzrobe call.
- **Buttons.** Anything that changes your data shows a Confirm and Cancel button first. Only the
  person who asked can press them, and the action runs with their own Wizzrobe token. Answers can
  also offer choices (for example when a name matches several players) and "Change something".
- **Follow-ups.** The responder sees the earlier turns, so you can keep going in a reply chain.
  Private answers cannot be replied to, so they carry an "Ask a follow-up" button instead.
- **Private answers.** Anything about one person (`/me`, linked actions) is ephemeral. On the
  message path, "Show me privately" moves a personal answer out of the channel. Only schedule,
  stream and standings answers post publicly.
- **Casual chat.** Greetings, thanks, banter and off topic. Chat holds no game reference; game
  questions have their own route (below).

## Game knowledge

Game questions (items, dungeons and areas, bosses, mechanics, randomizer logic, tricks) go to the
`game` route. Its reference is siloed so a question loads only what it needs, never the whole
text.

- **Where it lives.** `prompts/<game>/` holds one folder per game: `prompts/alttp/`,
  `prompts/sm/` and `prompts/z1r/`. In a game folder: `general.md` (orientation), `overworld.md` (reaching each
  entrance or area, plus locations and caves), `items.md` (items and glossary),
  `dungeons/<key>.md` (one per dungeon or area: boss, layout, enemies, keys, its overview row,
  boss row and enemy notes) and `logic/` (A Link to the Past: `keys.json`, the key door table,
  and `requirements.json` and `requirements-hmg.json`, the per-location rules exported from the
  door randomizer; Super Metroid and Zelda 1: one hand-written `logic/<key>.md` per area or
  level). No dashes; `scripts/check-rules.ts` scans them.
- **Super Metroid.** `prompts/sm/` covers the story, the seven areas of Zebes (Crateria,
  Brinstar, Upper and Lower Norfair, the Wrecked Ship, Maridia, Tourian), the bosses and
  minibosses, the items, the techniques and the community vocabulary, plus the randomizer's logic.
  The randomizer is the Super Metroid Item Randomizer served at samus.link (tewtal's
  SMZ3Randomizer, project Randomizer.SuperMetroid), with its Casual and Tournament logics. Its
  area entry rules, per-location rules and predicates were read from that code; other
  randomizers (VARIA, DASH, the SMZ3 combo) have different rules and are not mixed in. Each area
  has `dungeons/<key>.md` (lore, bosses, entry rule) and `logic/<key>.md` (entry rule, predicate
  legend, every location's rule in both logics). The keys are `crateria`, `brinstar`,
  `norfair_upper`, `norfair_lower`, `wrecked_ship`, `maridia` and `tourian`; a boss resolves to
  its area, and "norfair" on its own loads both halves.
- **Zelda 1 Randomizer.** `prompts/z1r/` covers The Legend of Zelda (NES) and Z1R, the
  randomizer by Fred Coughlin: the story and the second quest, the nine levels (keys `level1` to
  `level9`, also called by their first quest shapes Eagle, Moon, Manji, Snake, Lizard, Dragon,
  Demon, Lion and Death Mountain), the bosses, the items and what each one gates, the hint
  phrases that work as logic clues, the guarantees the generator keeps, the flags and where the
  community races. A boss resolves to its vanilla level (Aquamentus to `level1`, Ganon to
  `level9`). Each level has `dungeons/<key>.md` (shape, boss, vanilla items, access gate, boss
  requirement, hint phrases) and `logic/<key>.md` (entry rule, what the level needs inside, and
  the guarantees that name it). Sources are the Z1R wiki (z1r.wiki) and the original Z1R site;
  the program is closed source and its rules are documented only in pieces (the Guarantees page,
  the FAQ, the flag pages and the in-game hint phrases), so there is no formal spec to read.
  Nothing about the SpeedGaming Live 2026 Z1R flags is loaded yet.
- **The router picks.** For a game question it returns a `routine` (`dungeon`, `logic`,
  `overworld`, `items` or `general`), the `subjects` the asker named (up to four) and the `game`
  (`alttp`, `sm` or `z1r`). With no `game`, it is read from what the subjects resolve to, then defaults
  to `alttp`. A `subjects` value that is malformed is dropped, never fatal; only the first four
  valid names are kept. When the router sends a question to `chat` but the text names a dungeon,
  boss or item (whole words; the two letter codes are ignored), `src/game/override.ts` moves it
  to `game` and logs `router.override`. `src/game/catalog.ts` holds the areas, bosses and items of each game with their
  aliases and resolves written names (case, punctuation, plurals and possessives ignored). A name
  several games have (bombs, bow, book, boomerang, silver arrows, Ganon) keeps one entry per game:
  with a game given only that game's entry counts, and with none an area or boss decides the game,
  then the items only one game has, then `alttp`. Short names that are also everyday words (ice,
  speed, wave) and the two letter names (HJ, SJ, PB, G4, L1 to L9) are read in a name list but
  never inside a sentence. Zelda 1 keeps its own list of such words (raft, ladder, candle, bait,
  letter, key, ring, wand, book, bow, arrows, bombs, shield, sword, heart, and the first quest
  shape names) that the sentence scan skips for that game only, so only its multi-word and
  unambiguous names (Magic Key, Level 7, Gohma) send a chat question to the game route.
- **The prompt.** `src/game/slices.ts` builds the system blocks: the routine's instructions
  (`src/game/routines.ts`, protected by the prompt leak guard), then at most two subject blocks
  (sorted by key, extras merged into the second; the `logic` routine adds the rendered key door
  table with the location requirements or, for Super Metroid, the area's location rules; it uses
  a glitched section only when the question names that logic), each cached for an hour, then the
  clock and asker last and uncached. Names the notes
  cannot place are listed by name in the last block, and the model is told to say so rather than
  guess.
- **Rebuild after editing.** The notes travel as code in `src/game/data.ts`, generated by
  `npm run build:game` (for a game with a `keys.json` it also renders `logic/<key>.md` from it,
  followed by the location requirements; those are not files on disk). `npm run check` fails
  until you rebuild.
- **Re-export the key table.** `python3 tools/export-key-logic.py
  path/to/ALttPDoorRandomizer/source/dungeon/StaticKeyLogic.py` rewrites
  `prompts/alttp/logic/keys.json` (standard library only; the module is parsed, never imported).
  Then run `npm run build:game`. The code-based cases (Ganon's Tower chests, Turtle Rock by
  entrance, forbidden placements) are not exported.
- **Re-export the location requirements.** `tools/export-dungeon-logic.py` builds the door
  randomizer's vanilla world in memory (open mode, vanilla doors and entrances, static key logic,
  no shopsanity, no pottery) and asks the real engine what every dungeon location needs: the
  items (with the level of a progressive item), the any-of groups, the small key count (and the
  higher count when one item is missing) and the big key, each beyond what entering the dungeon
  needs, plus that entry requirement. It imports the randomizer, so run it with the randomizer's
  own Python (its venv), from this repository:

  ```sh
  PY=path/to/ALttPDoorRandomizer/.venv/bin/python
  $PY -B tools/export-dungeon-logic.py path/to/ALttPDoorRandomizer noglitches
  $PY -B tools/export-dungeon-logic.py path/to/ALttPDoorRandomizer hybridglitches
  $PY -B tools/export-dungeon-logic.py path/to/ALttPDoorRandomizer noglitches --check
  ```

  The first two rewrite `prompts/alttp/logic/requirements.json` and `requirements-hmg.json`
  (about 25 seconds each); `--check` writes nothing and fails if the full inventory no longer
  reaches every dungeon location. Then run `npm run build:game`: each `logic/<key>.md` gets a
  "Location requirements" section and a "Hybrid Major Glitches" section listing only what
  differs. A file stays under 6,000 characters; over that, identical lines are grouped, then the
  dungeon name is dropped from location names, and the build fails if it is still over. The two
  JSON files feed the rendering only and are left out of `data.ts`.
- **Add a game.** Add its entries to `src/game/catalog.ts` (areas, bosses, items with the `game`
  field), create `prompts/<game>/` with the same file names, and run `npm run build:game`. The
  `game` id is already in the router schema.

## Event facts and the prize pool line

SpeedGaming Live 2026 is on site Thursday October 22 to Sunday October 25. The event's own facts
(dates, venue, hotel block, ticket tiers, volunteering, Twitch channels, Discord invite, bracket
and schedule links) live in one file, `prompts/event/sgl26.md`, kept under 4,500 characters, no
dashes. Questions about them route to `help`.

- **The prompt.** `src/responders/base.ts` adds the file as its own cached block (one hour) after
  the instructions block, for the `help` and `tournaments` routes only, ahead of the uncached
  block with the clock. The `help` spec says to answer those questions only from it and never to
  guess a time of day it does not give.
- **Refresh it.** Edit `prompts/event/sgl26.md`, update its "Reviewed" line, and run
  `npm run build:game`. That compiles every `prompts/event/*.md` into `src/game/data.ts` under the
  key `event/<file>` (the event folder holds flat markdown files only), and `npm run check` fails
  until you do. Facts that are unconfirmed or staff-only stay out of the file.
- **Prize pool line.** With `MATCHERINO_BOUNTY_ID` set (digits only; empty turns it off, and then
  no request is made), `src/event/prizepool.ts` reads the bounty's public balance from
  `https://api.matcherino.com/__api/bounties/balance` with a 4 second timeout. Only the total is
  read, never donor data. The result is cached in Redis for 5 minutes (`wb:v1:prizepool:{id}`), with a copy kept for
  24 hours as the fallback (`wb:v1:prizepool:stale:{id}`). The help route gets one line in its uncached block, for example
  `Community prize pool total: $15,140 (updated 14:05)`, on the community clock. If Matcherino
  fails, the stale line is used, or none; the answer is never held up beyond the timeout and a
  failure is logged as `prizepool.fetch_failed`.
- **Attendee list.** With the same `MATCHERINO_BOUNTY_ID` set (empty turns it off, and then no
  request is made), `src/event/participants.ts` reads the bounty's public participants list from
  `https://api.matcherino.com/__api/bounties/participants`, 500 per page with a 5 second timeout
  per request, and up to three more pages when the list is longer. The endpoint also returns ids
  and avatar links that carry Discord ids; they are dropped when the response is parsed, so only
  each display name and join time is ever held, cached or logged. The trimmed list is cached in
  Redis for 20 minutes (`wb:v1:participants:{id}`) with a copy kept for 24 hours as the fallback
  (`wb:v1:participants:stale:{id}`); a failed fetch, including any single failed page, uses the
  stale copy or none and is logged as `participants.fetch_failed` with a status or error name
  only. The players route reaches it through the `event_participants` tool, which searches by
  display name (exact first, then whole-word matches, at most 5) and returns the matches with
  their join date, the total, and a note. A match means the person is on the SGL26 attendee list;
  the players route checks the on-site tournaments' matches first, then this list.

## Owner only

`/dmlog [day]` shows who sent DMs on a day (default today, community timezone, or `YYYY-MM-DD`):
the total, a count per person, and the latest questions with a clipped answer. It is private,
needs no model call, and answers "That command is for the bot's owner." to anyone whose Discord id
is not in `OWNER_DISCORD_IDS` (comma-separated; empty means nobody). `/help` does not list it.

Every relayed DM is logged in Upstash Redis (`wb:v1:dmlog:{day}`, one JSON line each, and
`wb:v1:dmcount:{day}`, a count per Discord id), with the question clipped to 300 characters and the
answer to 500. Both keys expire after 14 days. The count is also the daily cap: at `DM_DAILY_LIMIT`
the bot declines in the DM and logs the attempt as `rate_limited`. A failed log write only warns;
the answer still goes out.

## Architecture

A Vercel app (TypeScript, plain API routes) receives Discord HTTP interactions (slash commands,
buttons, modals) and the OAuth callback. A small discord.js relay on Railway holds the gateway
connection and forwards mentions, DMs and replies, with the reply chain, to the signed
`/api/message` endpoint on Vercel, which posts the answer itself. Each request goes through a
Claude Haiku router, a code permission check, then a Claude Sonnet responder that reads Wizzrobe
through the MCP connector on the Messages API. Writes are called directly over MCP after a
Confirm. Upstash Redis holds linked accounts, cache, conversation state, the spend counter and
the kill switch. Bracket answers give the bracket and rules links; live standings are in
[docs/backlog.md](docs/backlog.md). See [plan.md](plan.md); deploying starts at
[docs/handoff-deploy.md](docs/handoff-deploy.md).

## Local dev

```
npm ci
npm run check     # typecheck, Biome, vitest, scripts/check-rules.ts
npm run eval      # the eval suite
```

Copy `.env.example` to `.env.local` for local runs. Only names are in the tree; real values never
are. `npm run register` registers the slash commands.

## Docs

- [plan.md](plan.md): architecture, routes, open questions, status.
- [docs/deploy-checklist.md](docs/deploy-checklist.md): every deploy step, account and env var.
- [docs/build.md](docs/build.md): how the build runs.
- [docs/contracts.md](docs/contracts.md): layout, types and module signatures.
- [docs/tasks.md](docs/tasks.md): the task DAG.
- [docs/lessons.md](docs/lessons.md): failure modes as rules with tests.
- [docs/wizzrobe-surface.md](docs/wizzrobe-surface.md): every Wizzrobe tool and who may call it.
- [relay/README.md](relay/README.md): the Railway relay.
