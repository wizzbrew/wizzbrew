REVIEW FIX R2b: concurrent refresh must not unlink      model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 30k tokens. Read only READ, once. No subagents.

SETUP: `git checkout -B build/r2b build/integration` then `npm ci`.

FINDING (security reviewer)
Two concurrent refreshes for one user (a Confirm during an /ask) reuse the same refresh token. If
Wizzrobe rotates refresh tokens, the second gets 400/401 and `deleteLink` silently unlinks a user
who did nothing wrong.

READ: src/wizzrobe/tokens.ts, tests/unit/tokens.test.ts; exports of src/store/kv.ts, keys.ts,
src/wizzrobe/identity.ts.

OWN: src/wizzrobe/tokens.ts, tests/unit/tokens.test.ts.

CHANGES
1. userAccessToken refresh path: take a short lock `kv().setIfAbsent(keys.cache("refresh",
   id), 1, 15)`. Not acquired: wait 300 ms up to 10 times for the access-token cache to fill, then
   use it; still empty -> refresh anyway.
2. On a 400/401 from refresh: re-read the link with getLink. If its sealedRefreshToken differs
   from the one just used (another refresh rotated it), retry once with the new one. Only if the
   same token fails do you deleteLink and throw the expired NotLinkedError.
3. Release the lock in finally. Same treatment for botAccessToken (lock key
   `keys.cache("refresh", "bot")`; never delete anything for the bot).
4. Tests: two concurrent userAccessToken calls refresh once; a 401 after another refresh rotated
   the token -> retry succeeds, link kept; a genuine 401 still unlinks.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); perl dash check clean; one commit on build/r2b
"fix(tokens): serialize refreshes and never unlink on a race" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; use `import(`; type a dash.

REPORT (at most 100 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
