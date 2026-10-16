# Build status

Builder: Opus 5.5 on `build/integration`. Cards live in `docs/cards/`.

## Current wave

Wave 0: W0 dispatched.

## Tasks

| Task | Model | State | Branch | Commit |
|---|---|---|---|---|
| W0 scaffold and contracts | sonnet | dispatched | build/w0 | |

Waves 1 to 4 (T01 to T27): queued.

## Gates

| Gate | Result |
|---|---|

## Open fix cards

None.

## Decisions and notes

- 2026-10-15: contracts refined before W0 (`docs/contracts.md`): conventions (NodeNext, `.js`
  imports, `import type` from discord-api-types, `set*ForTests` seams), Config fields and env
  names, log signature, `userMessageFor` table, `DiscordError`, `LinkRecord`, `ThreadRecord`,
  `getLink`, threads in `actions/pending.ts`, handler exports, REST bodies from the OpenAPI spec,
  the Fakes interfaces.
- Workers branch with `git checkout -B build/<id> build/integration` as their first step, so the
  base is right whether or not `worktree.baseRef` is honored.
- Vercel `maxDuration` 300 s (Hobby maximum with Fluid compute; Pro allows 800).
- Upstash env names are the Vercel integration's: `KV_REST_API_URL`, `KV_REST_API_TOKEN`.
- Challonge: v2.1 is current (v1 docs redirect to it). Base `https://api.challonge.com/v2.1`,
  headers `Authorization-Type: v1` plus `Authorization: <key>`, `Content-Type:
  application/vnd.api+json`, `Accept: application/json`; community tournaments need
  `community_id=<subdomain>`; 25 per page by default.
- For T07: the `process.env` rule must exempt `tests/setup.ts`.

## Open questions for Vince

- Challonge free apps are capped at 500 requests a month (429 after). A 120 s cache across 15
  tournaments can exceed that in a day. Decide before T26: a longer cache, a monthly counter, or
  a paid tier.
