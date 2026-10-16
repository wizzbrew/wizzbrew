# Build design

How Wizzbrew gets built: one **builder** session (Opus) that plans, dispatches, integrates,
tests and ships, and many short-lived **worker** subagents that write the code. Workers are
mostly Sonnet, with Haiku for pure modules.

**The builder writes no code. None, including the scaffold.** Every line of code and test comes
from a worker running one task card. The builder writes cards, reads reports and diffs, runs
gates, merges, and decides. That keeps Opus tokens on decisions and verification, and it keeps
every module written from its card alone, so no planning conversation leaks into the code.

Start the builder as a **fresh session in `~/gitrepos/wizzbrew`**, never as a continuation of the
planning conversation. The docs in this repo are the whole brief.

Read with: `docs/contracts.md` (what the code looks like), `docs/tasks.md` (the task DAG),
`docs/lessons.md` (the failure modes every task must respect).

## Roles

| Role | Model | Does | Never does |
|---|---|---|---|
| Builder | Opus 5.5 (the session) | Writes task cards, dispatches, merges, runs gates, triages, writes fix cards, reads every prompt, keeps `BUILD_STATUS.md`, ships | Writes or edits any code, test, config or prompt file; reads worker transcripts |
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

If a card won't fit, split it before dispatch. The window isn't what limits this (see "Plan
constraints"). A small, complete card is what makes a worker finish in one pass, with no
auto-compaction and no retry.

## Plan constraints (Claude Max 5x)

Vince runs this on **Claude Max 5x** with extra usage enabled. Checked 2026-10-15 against
code.claude.com/docs/en/model-config, /context-window, /sub-agents, /costs, and
support.claude.com/en/articles/11145838.

| Fact | Design consequence |
|---|---|
| Opus 5.5, Sonnet 5.5 and Haiku 5.5 all run with a 1M window in Claude Code by default. A subagent's window is sized by its own model. | Windows are not the limit. Cards stay at about 50k for one-pass quality. |
| Auto-compaction applies to subagents too. | A worker that compacts has lost part of its card. Treat a compacted worker as a split-the-card signal, not a success. |
| The 5-hour and weekly limits are shared between claude.ai and Claude Code, across models. Opus and Sonnet have separate per-family limits. Haiku's bucket is not documented. | The builder is the only Opus consumer. The bulk of the tokens (workers, fixers, reviewers) draw on the Sonnet pool or Haiku, so a build doesn't drain the Opus allowance. |
| By default at most 20 subagents run at once (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`), nested at most 3 deep. | At most 9 workers per wave: well under the cap, and a burst that fits one 5-hour window. Workers never spawn agents. |
| Extra usage bills past the limits at API rates. | The build must not depend on it. Before starting, Vince sets a monthly cap with `/usage-credits`. If a limit is hit mid-wave, stop and resume later (below) rather than buying through it. |
| `isolation: "worktree"` branches from the default branch unless `worktree.baseRef` is `"head"`. | The repo's `.claude/settings.json` sets `"worktree": {"baseRef": "head"}`, and the builder stays on `build/integration`, so every worker starts from the integrated state. The builder creates this settings file by dispatching it as part of W0, not by writing it. |

### Resuming after a limit or a crash

The builder keeps `BUILD_STATUS.md` (tracked, at the repo root), updated after every dispatch and
merge:

- the current wave,
- each task's state (`queued`, `dispatched`, `merged`, `failed: <gate>`),
- each task's branch and commit,
- open fix cards,
- gate results.

A fresh builder session reads it, checks which `build/<id>` branches already have their commit,
merges those, and re-dispatches only what is missing. Task branches survive a session ending.
`BUILD_STATUS.md` is a status record, not code, so the builder may write it.

## Why parallel work doesn't collide

1. **Frozen contracts.** Wave 0 commits every type and every module signature as a stub (see
   `docs/contracts.md`). Workers fill in bodies against fixed signatures, so module A can be
   written while B, which it calls, is still a stub.
2. **File ownership.** Every file belongs to exactly one task. No two tasks in a wave own the same
   file. Shared files (`src/types.ts`, `src/errors.ts`, `package.json`, configs) are written by
   W0 and frozen after it. A worker that needs a dependency or a type change stops and reports.
   The builder then issues a small contract-change card to a worker, merges it, and re-dispatches.
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
wave 0  builder: write the W0 card; one sonnet worker builds the scaffold, pins deps, writes the
        contracts as stubs and the fake interfaces; builder reads the type and signature diff
        against docs/contracts.md line by line, runs `npm run check`, merges, freezes
for each wave 1..4:
  builder: expand each task in docs/tasks.md into a full card (template below)
  builder: dispatch every card of the wave in ONE message (parallel Agent calls),
           model per task, isolation "worktree"
  workers: implement, run their task gate, commit, return the report
  builder: read reports; merge branches --no-ff into build/integration
  builder: run the wave gate (`npm run check`)
    green -> next wave
    red   -> fix card -> new sonnet fixer (worktree) -> merge -> re-run gate
             (at most 2 fixers per failure; then a sharper card or an opus fixer, or ask Vince)
review:  3 sonnet reviewers in parallel (lessons, security, contracts+tests) -> findings
         builder triages -> fix cards -> fixers -> gate
ship:    final gate, fast-forward or PR into main, tag v0.1.0
live:    with Vince: keys, Discord app, Wizzrobe client, preview deploy, smoke, evals
```

The builder may run waves with the Workflow tool if Vince asks for one ("use a workflow").
Otherwise, use parallel Agent calls in one message. No wave has more than 9 tasks.

## Task card template

The builder writes one per task, from `docs/tasks.md`. Cards are self-contained: the worker should
not need to look anything up.

```
TASK <id>: <title>                         model: <sonnet|haiku>   wave: <n>

BUDGET (your limits; plan around them)
- You run on Claude <Sonnet|Haiku> 5.5 with a 1M-token window, on a Claude Max 5x plan whose
  usage is shared with other workers running right now.
- This task is sized for about 50k tokens total: this card (~<n>k), the READ list (~<n>k), and
  about <n> lines of output. Finish in one pass.
- Read only what READ lists, once. Don't explore the repo, re-read files, or run the full suite;
  run only the commands in DONE WHEN.
- If you see the job needs more than about 80k tokens, or files outside OWN, stop and report
  STATUS: SPLIT with what the extra piece is. A split is cheaper than a half-finished task.
- Don't spawn subagents.

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
STATUS: DONE | BLOCKED | SPLIT
EFFORT: about <n>k tokens used; compacted: yes | no
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
less anchored. After two failed fixers on the same failure, the builder writes a sharper card
(split, more context pasted, an `opus` fixer for that one card) or asks Vince. The builder never
patches the code itself.

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

The builder knows its own limits too:

- It is the only Opus consumer, drawing on the Opus pool of a Max 5x plan.
- Its window is 1M, but aim to finish the build under about 400k tokens of its own context.
- If `/usage` shows the 5-hour or weekly limit close, finish merging what has landed, update
  `BUILD_STATUS.md`, and stop cleanly instead of dispatching a wave it can't gate.
- Use each report's `EFFORT` line to calibrate the next cards. A worker that used under 25k could
  have taken more scope; one that compacted or sent SPLIT needs a smaller card next time.

Habits:

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

## Kickoff

Before starting: set an extra-usage cap with `/usage-credits`. Then open a new Claude Code session
in `~/gitrepos/wizzbrew`, on Opus, and paste:

```
Build Wizzbrew. Read CLAUDE.md, plan.md, docs/build.md, docs/contracts.md, docs/tasks.md and
docs/lessons.md first. You are the builder and you write no code: every file of code, tests and
config comes from a subagent running a task card. Start with W0 (one sonnet worker), then waves
1-4 with workers in parallel (model per docs/tasks.md, isolation worktree), merge, gate, fix
with fresh fixers, review, and ship to main. Keep BUILD_STATUS.md current. Ask me before
pushing to GitHub or deploying.
```

To resume after a usage limit: the same prompt plus "Resume from BUILD_STATUS.md."
