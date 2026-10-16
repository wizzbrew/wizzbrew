REVIEW FIX R3b: dispatch, buttons, freshness, pending   model: sonnet   wave: review (after R3a)

BUDGET: Claude Sonnet 5.5, about 55k tokens. Read only READ, once. Over 85k: SPLIT. No subagents.

SETUP: `git checkout -B build/r3b build/integration` (R3a merged) then `npm ci`.

FINDINGS
- Plain /schedule with an ambiguous name returns choices but no thread, so no buttons render.
- dispatch.ts's outer catch logs nothing.
- Signed interactions have no timestamp freshness check; Confirm ignores the kill switch.
- A non-owner pressing Confirm takes then restores the pending record, so the owner can get a
  false "expired".
- component.ts sends text without finalizeText (dashes, 2000 chars); a non-owner's choose or an
  expired thread edits someone else's public message.
- /schedule (direct) skips the per-user rate limit.

READ: src/handlers/dispatch.ts, api/interactions.ts, src/handlers/component.ts,
src/actions/pending.ts and their tests; exports of src/ops/rate.ts, src/actions/pending.ts
(saveThread), src/discord/markup.ts (finalizeText), src/ops/alerts.ts (isPaused).

OWN: src/handlers/dispatch.ts, api/interactions.ts, src/handlers/component.ts,
src/actions/pending.ts, src/handlers/ask.ts (one line), src/handlers/message.ts (one line) and
tests/unit/dispatch.test.ts, api.test.ts, component.test.ts, pending.test.ts, ask.test.ts,
message.test.ts.

CHANGES
1. dispatch /schedule: `allowRequest` first (false -> the R3a rate message); when
   scheduleAnswer returns choices, save a thread (decision: route schedule with the params,
   turns: [], ephemeral false) and deliver with its id.
2. dispatch outer catch: `catch (err)`, log error with name and requestId, reply with
   userMessageFor(err).
3. dispatch components: confirm presses honor `isPaused()` (type 4 ephemeral "Wizzbrew is paused
   right now.").
4. api/interactions.ts: reject (401) when |now - X-Signature-Timestamp| > 300 s, after the
   signature check.
5. pending.ts takePending: `get` first; another user -> "not_yours" without touching the record;
   the owner -> `take` (atomic); a null take -> "expired".
6. component.ts: every edit and followup text goes through `finalizeText(...)[0]`; a non-owner's
   choose on a public thread runs the pipeline with a NEW reply target (an ephemeral followup)
   instead of editing the original; an expired thread replies privately (followup flags 64)
   instead of blanking the shared message.
8. Public errors: any reply that others can see uses `userMessageFor(err, {public: true})`.
   In ask.ts the condition becomes `reply.kind === "message" || !reply.ephemeral`; message.ts
   (errors before the pipeline) always public; dispatch.ts uses public for non-ephemeral
   deferrals; component.ts uses public when editing a public message.
7. Tests for each.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); perl dash check clean; one commit on build/r3b
"fix(handlers): schedule choices, freshness, kill switch on confirm, safer buttons" with the
trailer "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; use `import(`; type a dash.

REPORT (at most 120 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
