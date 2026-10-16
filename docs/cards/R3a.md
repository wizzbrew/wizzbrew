REVIEW FIX R3a: pipeline, delivery, errors, rate limit  model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 55k tokens. Read only READ, once. Over 85k: SPLIT. No subagents.

SETUP: `git checkout -B build/r3a build/integration` then `npm ci`.

FINDINGS (three reviewers)
- The per-user lock (120 s) can expire while a responder runs (deadline 240 s).
- The one-time OAuth URL is stored in thread turns and goes to the model on a follow-up.
- On the message path an error reply is public and can echo private Wizzrobe detail.
- Anthropic SDK 429/529/5xx show "Something went wrong" and page staff.
- No per-user rate limit: one person can burn the shared budget and bot token.

READ: docs/contracts.md "Review fixes"; src/handlers/ask.ts, src/handlers/deliver.ts,
src/errors.ts and their tests; exports of src/store/kv.ts, keys.ts.

OWN: src/handlers/ask.ts, src/handlers/deliver.ts, src/errors.ts, src/ops/rate.ts (new) and
tests/unit/ask.test.ts, deliver.test.ts, errors.test.ts, rate.test.ts (new).

CHANGES
1. ask.ts: lock TTL 300. Before the lock: `allowRequest(asker.discordUserId, now)` false ->
   deliverError "You're asking faster than I can keep up. Give it a minute." and stop.
2. ask.ts: for route `account`, the stored assistant turn text is "(sent a private account
   link)" instead of the answer text; `held` keeps the real answer (private, short-lived).
3. ask.ts alert classification: Anthropic SDK errors with status 429 or 529 are not alerts (they
   are load), 5xx are.
4. errors.ts: `userMessageFor(err, opts?: {public?: boolean})`: with public, WizzrobeError 400 and
   403 and DiscordError lose their detail ("Wizzrobe turned that down." / "Your Wizzrobe account
   can't do that." / "I couldn't post that in Discord."). Anthropic SDK errors (objects with a
   numeric `status` from "@anthropic-ai/sdk", check with `instanceof APIError`) with 429, 529 or
   5xx -> "The model is busy right now. Try again in a minute."
5. deliver.ts deliverError on a message target uses the public variant (the caller passes the
   error message already; change the pipeline to call `userMessageFor(err, {public:
   reply.kind === "message"})`).
6. ops/rate.ts `allowRequest(id, now)`: two counters with `kv().incrByFloat` on
   `keys.cache("rate", "m-" + id + "-" + minute)` (TTL 120) and `"h-" + id + "-" + hour"` (TTL
   7200); allowed when the minute count is at most 8 and the hour count at most 60.
7. Tests for each.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); perl dash check clean; one commit on build/r3a
"fix(handlers): lock, private link turns, public errors, rate limit" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; use `import(`; type a dash.

REPORT (at most 120 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
