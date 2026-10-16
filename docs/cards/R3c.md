REVIEW FIX R3c: relay endpoint and message path        model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 35k tokens. Read only READ, once. No subagents.

SETUP: `git checkout -B build/r3c build/integration` then `npm ci`.

FINDINGS
- The message path never calls normalizeInput (L6): `<t:...>` timestamps and emoji reach the
  model raw, in the message and in the chain.
- No dedupe on messageId: a relay retry or replay answers twice.
- api/message.ts logs the message text; log its length only.
- Paused: the endpoint stays silent while slash commands say "paused".

READ: src/handlers/message.ts, api/message.ts and their tests; exports of
src/discord/markup.ts (normalizeInput), src/store/kv.ts, keys.ts, src/handlers/deliver.ts.

OWN: src/handlers/message.ts, api/message.ts, tests/unit/message.test.ts,
tests/unit/api-message.test.ts.

CHANGES
1. message.ts: `normalizeInput` on m.content and on every chain entry's content, before
   sanitizeForPrompt.
2. api/message.ts: after verification and parsing, `kv().setIfAbsent(keys.cache("msg",
   m.messageId), 1, 600)` false -> 200 `{duplicate: true}` and nothing else.
3. api/message.ts: log `{messageId, channelId, length}` only.
4. Paused: reply under the message with "Wizzbrew is paused right now." through
   `deliverError({kind: "message", channelId, messageId}, ...)` inside waitUntil, then 200.
5. Tests: a `<t:1792195200:f>` in content and in the chain arrives as ISO text; duplicate POST
   answers once; the log has no content; paused posts the reply.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); perl dash check clean; one commit on build/r3c
"fix(message): normalize input, dedupe, quiet logs, paused reply" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; use `import(`; type a dash.

REPORT (at most 100 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
