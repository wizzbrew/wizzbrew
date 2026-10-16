# Build status

Builder: Opus 5.5 on `build/integration`. Cards live in `docs/cards/`.

## Current wave

Wave 1: dispatched (9 tasks).

## Tasks

| Task | Model | State | Branch | Commit |
|---|---|---|---|---|
| W0 scaffold and contracts | sonnet | merged (about 95k tokens) | build/w0 | 967adac |
| T01 time | sonnet | merged (about 45k; 37 tests; "Oct 8 pm" is refused as ambiguous) | build/t01 | a587d39 |
| T02 discord I/O | sonnet | merged (about 40k; network failure -> DiscordError(0)) | build/t02 | a5f51eb |
| T03 markup | haiku | dispatched | build/t03 | |
| T04 render and components | haiku | merged (about 96k: over budget, split similar cards) | build/t04 | 0e5780d |
| T05 store | haiku | merged (about 40k; bad key surfaces as config error) | build/t05 | 36848d4 |
| T06 models and budget | haiku | merged after T05; budget tests 12/12 green on the real seam (card error, not code) | build/t06 | 3e825d0 |
| T07 resolve and rule checks | haiku | dispatched | build/t07 | |
| T08 fakes | sonnet | merged (about 45k; extra export `requestUrl` in tests/fakes/fetch.ts) | build/t08 | 2995d94 |
| T25 personality | sonnet | merged (about 20k tokens; voice text read in full) | build/t25 | 7fa7877 |

Waves 2 to 4: queued.

## Gates

| Gate | Result |
|---|---|
| W0 merge (`npm run check`) | green: typecheck, lint, 57 tests, rules stub |

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

- Challonge free apps are capped at 500 requests a month (429 after). A 120 s cache across 15
  tournaments can exceed that in a day. Decide before T26: a longer cache, a monthly counter, or
  a paid tier.
