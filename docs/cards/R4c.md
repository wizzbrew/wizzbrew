REVIEW FIX R4c: stray UTC times, relay DMs and errors   model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 40k tokens. Read only READ, once. No subagents.

SETUP: `git checkout -B build/r4c build/integration` then `npm ci` (and `npm ci` in relay/).

FINDINGS
- A raw UTC ISO string in model text reaches Discord unconverted (L5).
- The relay forwards DMs from anyone, a free path to spend money and the bot token.
- The relay's fetchRef swallows every error silently, so a reply to the bot can be ignored.

READ: src/discord/render.ts and its test; exports of src/time/time.ts; relay/src/index.ts,
relay/src/forward.ts, relay/test/forward.test.ts.

OWN: src/discord/render.ts, tests/unit/render.test.ts (and its snapshot if needed),
relay/src/index.ts, relay/src/forward.ts, relay/test/forward.test.ts.

CHANGES
1. render.ts: before finalizeText, replace every match of
   `\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b` with
   `discordTimestamp(parseWizzrobeTime(match), "f")` (time module, L2); leave text that doesn't
   parse.
2. relay: a DM is forwarded only when the author is a member of a guild that owns an allowlisted
   channel (resolve the guild ids from RELAY_CHANNEL_IDS at ready; check with
   `guild.members.fetch(authorId)` and cache the answer for 10 minutes). `shouldForward` gains an
   `isMemberOfAllowedGuild` input.
3. relay fetchRef: log a warning with the message id and error name before returning null.
4. Tests: render converts an ISO time and leaves other text; shouldForward refuses a DM from a
   non-member and allows a member.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); in relay/ `npx tsc --noEmit` and `npx vitest run` pass;
`npx biome check relay/src relay/test` passes; perl dash check clean; one commit on build/r4c
"fix: convert stray UTC times, relay DMs for members only, relay logs" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; use `import(`; type a dash.

REPORT (at most 100 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
