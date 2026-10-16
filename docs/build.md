# Build design

How Wizzbrew gets built: one **builder** session (Opus) that plans, dispatches, integrates,
tests and ships, and many short-lived **worker** subagents that write the code. Workers are
mostly Sonnet, with Haiku for pure modules. The goal is to spend Opus tokens on decisions and
verification, not on typing code, and to have every worker finish in one pass.

Read with: `docs/contracts.md` (what the code looks like), `docs/tasks.md` (the task DAG),
`docs/lessons.md` (the failure modes every task must respect).

## Roles

| Role | Model | Does | Never does |
|---|---|---|---|
| Builder | Opus 5.5 (the session) | Wave 0 scaffold and contracts, writes task cards, dispatches, merges, runs gates, triages, writes fix cards, reads every prompt, ships | Writes module bodies that a worker could write; reads worker transcripts |
| Worker | `sonnet` or `haiku` per task (Agent tool `model`), isolated worktree | Implements one card: owned files plus their tests, one commit | Touches files it does not own, changes a contract, edits `package.json`, explores the repo |
| Fixer | `sonnet` | Fixes one failing gate from a fix card | Changes contracts, or weakens a test to pass |
| Reviewer | `sonnet` | Reads the integrated code against one checklist, returns findings | Edits code |

### Which model writes which task

This is decided per task in `docs/tasks.md`.

- **Sonnet** writes anything that touches an external API or SDK: Discord, the Anthropic SDK, the
  MCP client, OAuth, Upstash, Vercel. It also writes the time module and the prompts. A cheaper
  model misremembering an SDK call costs a failed gate plus a fixer, which is more than the
  savings.
- **Haiku** writes pure, self-contained modules whose card fully states the behavior and the
  test cases: render, markup, keys, pricing, resolve, pending.

Each card is sized so the worker's whole job fits in about **50k tokens**:

- the card itself: at most 4k tokens,
- files it must read: at most 15k tokens,
- what it writes: at most about 600 lines of code plus tests.

That fits either model with room to spare, so no worker should hit compaction or a retry. If a
card won't fit, split it before dispatch. (Context window size isn't the constraint here; a small,
complete card is what makes a worker finish in one shot.)

## Why parallel work doesn't collide

1. **Frozen contracts.** Wave 0 commits every type and every module signature as a stub (see
   `docs/contracts.md`). Workers fill in bodies against fixed signatures, so module A can be
   written while B, which it calls, is still a stub.
2. **File ownership.** Every file belongs to exactly one task. No two tasks in a wave own the same
   file. Shared files (`src/types.ts`, `src/errors.ts`, `package.json`, configs) belong to the
   builder and are frozen after wave 0. A worker that needs a dependency or a type change stops
   and reports instead of adding it.
3. **No barrels.** There are no `index.ts` re-export files to fight over; import from the module
   path.
4. **Test isolation.**
   - Fakes for external boundaries live in `tests/fakes/` (one wave-1 task owns them).
   - A test may `vi.mock` a sibling `src/` module by its contract signature, because that sibling
     may still be a stub.
   - A test never mocks the module under test (L23).
   - Tests never need real env: `tests/setup.ts` sets dummy values.
5. **Worktrees.** Every worker runs with `isolation: "worktree"`, branched from the builder's
   integration branch at dispatch time, and commits only there.

## Branches, commits, PRs

- The builder works on `build/integration`, branched from `main`.
- Each task commits **once** on its worktree branch, `build/<task-id>`, with message
  `feat(<area>): <what>` (or `test(...)`, `chore(...)`). It ends with the Co-Authored-By trailer.
- After a wave, the builder merges each task branch into `build/integration` with
  `git merge --no-ff`. Every task stays visible as its own commit plus merge in history.
- **No GitHub remote yet:** after the final gate, fast-forward `main` to `build/integration`.
- **GitHub remote exists:** open one PR per wave from `build/integration` into `main`. Each
  description lists the tasks, gate results and anything deferred. Merge after the gates pass.
  Pushing a public repo, and anything deployed, needs Vince's go-ahead first.

## The loop

```
wave 0  builder: scaffold, pin deps, contracts as stubs, fakes interfaces, `npm run check` green
for each wave 1..4:
  builder: expand each task in docs/tasks.md into a full card (template below)
  builder: dispatch every card of the wave in ONE message (parallel Agent calls),
           model per task, isolation "worktree"
  workers: implement, run their task gate, commit, return the report
  builder: read reports; merge branches --no-ff into build/integration
  builder: run the wave gate (`npm run check`)
    green -> next wave
    red   -> fix card -> new sonnet fixer (worktree) -> merge -> re-run gate
             (at most 2 fixers per failure; then the builder fixes it or asks Vince)
review:  3 sonnet reviewers in parallel (lessons, security, contracts+tests) -> findings
         builder triages -> fix cards -> fixers -> gate
ship:    final gate, fast-forward or PR into main, tag v0.1.0
live:    with Vince: keys, Discord app, Wizzrobe client, preview deploy, smoke, evals
```

The builder may run waves with the Workflow tool if Vince asks for one ("use a workflow").
Otherwise, use parallel Agent calls in one message. No wave has more than 8 tasks.

## Task card template

The builder writes one per task, from `docs/tasks.md`. Cards are self-contained: the worker should
not need to look anything up.

```
TASK <id>: <title>                         model: <sonnet|haiku>   wave: <n>

GOAL
One sentence.

CONTEXT
2-4 sentences: what Wizzbrew is, where this module sits in the request flow.

READ (only these)
- docs/contracts.md#<section>
- <at most 4 source files, by path>

OWN (create or edit only these)
- src/...
- tests/unit/....test.ts

CONTRACT (pasted verbatim from src/, do not change)
<the exact exported signatures this task implements>

BEHAVIOR
1. Numbered, testable rules. Inputs, outputs, every error case and its error type.
2. External API facts the worker needs: endpoint, header, payload shape, pasted. No "look it up".
3. Lessons that apply, quoted as rules (from docs/lessons.md, by number).

TESTS (write these, all must pass)
- <test file>: <case> -> <expected>
- ...

DONE WHEN
- `npm run typecheck` passes
- `npx vitest run <your test files>` passes
- `npx biome check <your files>` passes
- one commit on your branch: "<type>(<area>): <message>" plus the Co-Authored-By trailer

DO NOT
- touch any file outside OWN; edit package.json, src/types.ts, src/errors.ts
- change an exported signature; add a dependency; leave TODOs or skipped tests
- use em dashes; read process.env outside src/config.ts

IF BLOCKED
Stop. Do not improvise around a contract. Report BLOCKED with the reason.

REPORT (your final message, at most 150 words, exactly this shape)
STATUS: DONE | BLOCKED
BRANCH: build/<id>   COMMIT: <sha>
FILES: <list>
TESTS: <n passed>
DEVIATIONS: none | <what and why>
NOTES FOR BUILDER: <anything the next wave needs to know>
```

## Gates

| Gate | Who runs it | Command | Blocks |
|---|---|---|---|
| Task | worker | typecheck plus own tests plus lint on own files | its commit |
| Wave | builder | `npm run check` = `tsc --noEmit` + `biome check` + `vitest run` + `tsx scripts/check-rules.ts` | next wave |
| Integration | builder, after wave 4 | `npm run test:e2e` (signed fake interactions through `handleInteraction` with all fakes) | review |
| Review | 3 Sonnet reviewers | read-only, checklist-driven | ship |
| Live | builder with Vince | preview deploy, Discord PING accepted, `/ask` smoke in test server, `npm run eval` | production |

`scripts/check-rules.ts` encodes the greppable lessons:

- L2: no time parsing or formatting outside `src/time/`.
- L19: no link-key reads outside `identity.ts`.
- No `process.env` outside `config.ts`.
- No em dashes anywhere in the tree.
- No empty `catch`.
- No dynamic `import(`.
- Every `MODELS` value has `PRICING`.
- No secrets patterns (`sk-ant-`, `wizzrobe_pat_`, Discord token shape).

## Fix cards

Same template as a task card, plus:

```
FAILURE
<the failing command and the relevant 20-60 lines of output, trimmed by the builder>
DIAGNOSIS (builder's best read, may be wrong)
<one paragraph>
FIX SCOPE
OWN lists only the files that should change. If the right fix is outside them, or the test
itself is wrong, report BLOCKED with why. Never weaken a test to make it pass.
```

A fixer is a fresh agent every time, never the worker that failed: a clean context is cheaper and
less anchored. After two failed fixers on the same failure, the builder fixes it or asks Vince.

## Reviewers

Three reviewers, dispatched in parallel after the integration gate. They read only; each returns
findings as `file:line, lesson or rule, what's wrong, suggested fix`, at most 40 lines.

1. **Lessons.** Every item in `docs/lessons.md` against the code.
2. **Security and permissions.**
   - Every write path requires Confirm from the same Discord user and uses that user's token.
   - The bot token never reaches a write.
   - The auth gate runs in code before responders.
   - No secret in the tree or the logs.
   - Ephemeral replies wherever one person's data shows.
   - Signature verification can't be bypassed.
3. **Contracts and tests.**
   - Code matches `docs/contracts.md`.
   - Tests assert behavior, not implementation.
   - No skipped tests.
   - The fakes match the real APIs' shapes.

## Builder token discipline

- Don't read worker transcripts. Read the 150-word report. Use `git diff --stat`, and open a file
  only when a gate fails, a reviewer flags it, or it's a prompt.
- **Read every prompt in full** (router and responder specs). Prompts are where cheap models
  drift and where beer-league's subtle bugs lived (L1, L10, L11, L14).
- Put contract excerpts into cards by pasting them, not by asking the worker to go read the code.
- When a gate fails, trim the output before it goes into a fix card.

## Blockers known now

- **The Wizzrobe tenant list is empty** for `homemadebeer` (2026-10-15). The whole build runs on
  fakes and fixtures shaped from the OpenAPI schemas. Only the live gate needs the real thing.
  After the tenant works, re-record fixtures from real responses and re-run the suite.
- **Live keys.** Vince creates the Anthropic key, the Discord app and the Wizzrobe OAuth client in
  the live phase (`plan.md`, "Deploying").

## Kickoff (paste into the new session)

```
Build Wizzbrew. Read CLAUDE.md, plan.md, docs/build.md, docs/contracts.md, docs/tasks.md and
docs/lessons.md first. You are the builder: do wave 0 yourself, then run waves 1-4 by
dispatching task cards to subagents in parallel (model per docs/tasks.md, isolation worktree),
merge, gate, fix, review, and ship to main. Ask me before pushing to GitHub or deploying.
```
