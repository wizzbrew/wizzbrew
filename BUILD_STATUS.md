# Build status

Builder: Opus 5.5 on `build/integration`. Cards live in `docs/cards/`.

## Current wave

Wave 2: T09 to T14 merged and green; T15, T26, T27 dispatched (schemas read live).

## Tasks

| Task | Model | State | Branch | Commit |
|---|---|---|---|---|
| W0 scaffold and contracts | sonnet | merged (about 95k tokens) | build/w0 | 967adac |
| T01 time | sonnet | merged (about 45k; 37 tests; "Oct 8 pm" is refused as ambiguous) | build/t01 | a587d39 |
| T02 discord I/O | sonnet | merged (about 40k; network failure -> DiscordError(0)) | build/t02 | a5f51eb |
| T03 markup | haiku | merged (about 60k) | build/t03 | e801d15 |
| T04 render and components | haiku | merged (about 96k: over budget, split similar cards) | build/t04 | 0e5780d |
| T05 store | haiku | merged (about 40k; bad key surfaces as config error) | build/t05 | 36848d4 |
| T06 models and budget | haiku | merged after T05; budget tests 12/12 green on the real seam (card error, not code) | build/t06 | 3e825d0 |
| T07 resolve and rule checks | haiku | merged (about 60k) | build/t07 | a5a16d6 |
| T08 fakes | sonnet | merged (about 45k; extra export `requestUrl` in tests/fakes/fetch.ts) | build/t08 | 2995d94 |
| T25 personality | sonnet | merged (about 20k tokens; voice text read in full) | build/t25 | 7fa7877 |
| F1 rule gate fix | sonnet | merged (about 25k; comments become a marker so a comment-only catch stays non-empty) | build/f1 | db01094 |
| T09 anthropic client | sonnet | merged (about 35k; token-count log keys renamed to dodge log redaction) | build/t09 | 502ca29 |
| T10 router | sonnet | merged (about 45k; prompt read in full) | build/t10 | cab24b9 |
| T11 wizzrobe oauth | sonnet | merged (about 50k) | build/t11 | cffb3e9 |
| T12 tokens and identity | sonnet | merged (about 40k; tokens and identity import each other, function-level only) | build/t12 | ac43fc1 |
| T13 mcp | sonnet | merged (about 45k; fetch wrapper captures Retry-After; real SDK path untested until live) | build/t13 | 688bee8 |
| T14 rest gaps | haiku | merged (about 35k) | build/t14 | fd5d369 |
| T15 pending and execute | sonnet (moved from haiku after T04 overran) | merged (about 40k; saveThread mints its own id: T18 uses the returned id) | build/t15 | 836d79f |
| T27 my matches and client tools | sonnet | merged (about 40k; tool JSON uses snake_case keys) | build/t27 | e6b6d63 |

Waves 3 and 4: queued.

## Gates

| Gate | Result |
|---|---|
| W0 merge (`npm run check`) | green: typecheck, lint, 57 tests, rules stub |
| Wave 1 (`npm run check`) | typecheck, lint, 271 tests green; rules red (4 findings) -> F1 |
| Wave 1 after F1 | green: typecheck, lint, 271 tests, rules ok (84 files), no dash characters |
| Wave 2 partial (T09, T10, T12, T13, T14) | green: typecheck, lint, 378 tests, rules ok (91 files) |
| Wave 2 partial plus T11 | green: typecheck, lint, 405 tests, rules ok (92 files) |

## Open fix cards

None open (F1 merged).

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
- Contract additions before wave 1: `parseUserDate` (time.ts; `/schedule day:` needs a date-only
  parse and L3 forbids `parseUserDateTime` from accepting a date without a time), and
  `CommandName` plus `COMMANDS` (commands.ts).
- Claude API facts for waves 2 and 3 (claude-api skill, 2026-10-15):
  - Prices per MTok: Haiku 5.5 0.10 in, 0.50 out, 0.01 cache read, 0.125 cache write (prompts
    up to 100K); Sonnet 5.5 2.00, 10.00, 0.20, 2.50.
  - Sonnet 5.5: `thinking: {type: "disabled"}` and forced `tool_choice` (`any`/`tool`) are 400s.
    Use adaptive thinking (the default) with `output_config.effort` (`medium` for responders),
    `tool_choice: auto` plus `strict: true` tools.
  - Haiku 5.5: thinking on by default, effort default `medium`; router runs at `low`.
  - Preserved thinking: a tool loop must append each assistant `content` unchanged (thinking
    blocks included) and never edit earlier turns.
  - MCP connector: `mcp_servers` plus an `mcp_toolset` entry, beta `mcp-client-2025-11-20`,
    `default_config: {enabled: false}` with per-tool `configs` for allowlist mode.
  - Server-side refusal fallbacks (`fallbacks: "default"`) are off for v0.1: a fallback answers
    from another model, which PRICING can't price (L12). A refusal is a ModelOutputError.

- W0 deviations accepted: Biome `"preset": "recommended"` (2.5 deprecates `recommended: true`);
  `BetaMessageCreateParams` aliases the SDK's `MessageCreateParamsNonStreaming`;
  `ROUTER_PROMPT` frozen in contracts.
- Wizzrobe hosts: `onsite.speedgaming.org` and `wizzrobe.synack.live` serve the same app (same
  OpenAPI, same OAuth metadata). OAuth endpoints all live on `wizzrobe.synack.live` (issuer).
  Use `WIZZROBE_BASE_URL=https://onsite.speedgaming.org` (as planned) and have T11 read the
  endpoints from `<base>/.well-known/oauth-authorization-server`, so no separate auth URL var is
  needed. Known non-secret values for the deploy checklist (T24): WIZZROBE_MCP_URL
  `https://wizzrobe.synack.live/mcp`, WIZZROBE_TENANT `sgl26`, COMMUNITY_TIMEZONE
  `America/New_York`, ANTHROPIC_DAILY_BUDGET_USD `5` (the planned default).

- SDK shapes confirmed by T08 against @anthropic-ai/sdk 0.131: text `{type, text, citations}`;
  thinking `{type, thinking, signature}`; tool_use `{type, id, name, input}`; mcp_tool_use
  `{type, id, name, server_name, input}`; mcp_tool_result `{type, tool_use_id, is_error,
  content: [text blocks]}`. BetaMessage also requires `container`, `context_management`,
  `diagnostics`, `stop_details` (null). Use `fakeMessage` and `block` from tests/fakes/anthropic.ts.
- Biome `--write` rewrites `U+2014`-style escapes in regex literals into literal dashes (T01).
  Cards that match or assert on dashes build them with `String.fromCharCode(0x2014, 0x2013)`.
- Card rule (from T06): a test may only call a sibling's seam (`set*ForTests`) when that
  sibling merged in an earlier wave. A sibling in the same wave is `vi.mock`ed by contract.

## Open questions for Vince

- Challonge: decided with Vince. Demand-driven snapshot per tournament, refreshed on an ask
  when older than 15 minutes, answers show the snapshot age, failures serve the stale snapshot.
  About a dozen asks a day means about 25 to 40 requests a day, inside the free 500 a month.
  Challonge v2.1 has no webhooks (its "broadcasted events" are browser postMessage events from an
  embedded bracket). Later: a Wizzrobe `match.*` webhook (staff configure it, phase 3) could mark
  a tournament's snapshot stale the moment a match finishes.
- Wizzrobe MCP connected 2026-10-15 evening. Live findings: write tools take `tenant` plus
  `match_id` or `tournament_id` (crew adds `role`); `submit_match_request` takes `player_ids`,
  `scheduled_date`, `scheduled_time`. Wizzrobe holds only scheduled matches with known players and
  their results (`finish_rank`); no bracket pairings, so Challonge stays for bracket structure.
  Synack says the Discord id fix is live on MCP, but `get_match` 4 still returned Synack's id as a
  JSON number ending ...220; the numeric guard stays. Tell Synack.
- Contract changes before T27 and T26: `matchesForAsker(asker, window)` replaces
  `matchesForDiscordUser` (one list_matches per question; linked askers matched by name; roster
  cache with a 20-call cap for unlinked); BracketSummary gains `upcoming`; Challonge refreshes on
  a new Wizzrobe result or after 6 h; `WRITE_ARGS` in execute.ts.
- Challonge v2.1 matches have no prerequisite-match field in the schema, so "you face the winner
  of X vs Y" can only name the round and the open slot. Check a live response in the live phase.

## For the deploy checklist (T24)

- Register `http://127.0.0.1:8976/callback` on the Wizzrobe OAuth client (next to the Vercel
  callback) before running `scripts/wizzrobe-login.ts`.
- `finishLink` reads then deletes the OAuth state; two simultaneous callbacks could both pass.
  Wizzrobe's one-time authorization code limits the damage. Revisit if Kv gains get-and-delete.
