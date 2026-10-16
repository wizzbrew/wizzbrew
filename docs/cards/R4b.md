REVIEW FIX R4b: honest confirm line, times, prompts     model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 55k tokens. Read only READ, once. Over 85k: SPLIT. No subagents.

SETUP: `git checkout -B build/r4b build/integration` then `npm ci`.

FINDINGS
- The Confirm text is the model's free-form summary, not derived from the validated args; an
  injected reply chain could make the text disagree with what runs.
- The model converts UTC ISO strings to epoch seconds itself (arithmetic by the model).
- SHARED_RULES dictates a quoted reply ("Wizzrobe doesn't show that"), which L11 says the model
  will parrot.
- A temporary Challonge failure reads as "live standings aren't available".
- The chat event block answers blind when its lookup fails and doesn't sanitize names.

READ: docs/contracts.md "Review fixes"; src/actions/execute.ts, src/responders/base.ts,
src/responders/specs.ts, src/responders/clientTools.ts, src/challonge/challonge.ts and their
tests.

OWN: src/actions/execute.ts, src/responders/base.ts, src/responders/specs.ts,
src/responders/clientTools.ts, src/challonge/challonge.ts and tests/unit/execute.test.ts,
responder.test.ts, specs.test.ts, client-tools.test.ts, challonge.test.ts.

CHANGES
1. execute.ts `describeAction(tool, args)`: the same wording family as the result lines, in the
   future ("Sign you up as commentator for match 41.", "Acknowledge match 18.", "Send a
   reschedule request for match 7: <reason clipped to 120>."). base.ts sets the proposal's
   `summary` to describeAction(tool, args), and appends the model's summary on a second line only
   as "Note: <model summary clipped to 200>".
2. clientTools.ts: every time in matches_for_me and challonge_bracket results also carries an
   `_epoch` sibling (Unix seconds), via the time module (L2).
3. specs.ts SHARED_RULES: replace the quoted phrase with a described behavior (say in one line
   that Wizzrobe has no record of it, and where to look). Times rule: use the `_epoch` fields when
   present. Standings: when `degraded` is true, say the bracket lookup failed just now and give
   the snapshot age or the links.
4. challonge.ts: BracketSummary `degraded: boolean`, true when a refresh was attempted and failed
   (the stale snapshot or link-only answer is served).
5. base.ts chat event block: when a lookup fails write "Event list unavailable right now." in its
   place; pass every tournament and stage name through sanitizeForPrompt.
6. Tests for each; the specs tests assert no double-quoted phrase longer than three words in
   SHARED_RULES.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); perl dash check clean; one commit on build/r4b
"fix: confirm line from args, epoch fields, prompt wording, degraded standings" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; list sample phrasings in prompts; use `import(`; type a dash.

REPORT (at most 120 words): STATUS, BRANCH/COMMIT, TESTS, DEVIATIONS.
