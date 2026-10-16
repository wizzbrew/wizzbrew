REVIEW FIX R4a: bot-token cap, unknown model price     model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 30k tokens. Read only READ, once. No subagents.

SETUP: `git checkout -B build/r4a build/integration` then `npm ci`.

FINDINGS
- Nothing caps calls on the shared bot token (Wizzrobe allows 120 a minute per token).
- recordSpend throws on an unknown `msg.model` after the paid call already happened.

READ: src/wizzrobe/mcp.ts (callTool), src/llm/budget.ts, src/llm/client.ts (recordSpend call)
and their tests.

OWN: src/wizzrobe/mcp.ts, src/llm/budget.ts, src/llm/client.ts and tests/unit/mcp.test.ts,
budget.test.ts, client.test.ts.

CHANGES
1. mcp.ts callTool: before an uncached call, `kv().incrByFloat(keys.cache("tokrate",
   sha256hex(token).slice(0, 16) + "-" + minute), 1, 120)`; over 100 -> throw
   `WizzrobeError(429, "too many Wizzrobe requests this minute", 30)` without calling. Cached
   reads don't count.
2. budget.ts `recordSpend(model, usage, now, fallbackModel?)`: unknown model with a known
   fallback -> price as the fallback and log warn "budget.unknown_model" with the model id;
   unknown without one -> throw as before. client.ts passes `MODELS[purpose]` as the fallback.
3. Tests for both.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); perl dash check clean; one commit on build/r4a
"fix: cap bot-token Wizzrobe calls, price unknown models safely" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; use `import(`; type a dash.

REPORT (at most 100 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
