# CLAUDE.md

## Project

Wizzbrew is a Discord bot for SpeedGaming Live 2026. People ask it questions in Discord (the
schedule, streams, standings, players, how things work) and it answers from Wizzrobe, the onsite
tool at onsite.speedgaming.org. Users who link their Wizzrobe account can also do a few things for
themselves: sign up as crew, acknowledge a match, offer it for stream.

Stack (planned):

- TypeScript on Vercel, receiving Discord HTTP interactions (slash commands, no gateway).
- A `claude-haiku-5-5` router, then agentic responders on `claude-sonnet-5-5` that reach Wizzrobe
  through the MCP connector on the Messages API.
- Upstash Redis for linked accounts, cache and state.

The pattern follows `~/gitrepos/alttpr-beer-league-bot`: router, then permission check, then
responder.

## Read first

- `plan.md`: architecture, routes, open questions, deploy steps. Status lives there.
- `docs/build.md`: how the build runs (builder plus parallel workers, gates, fix loop).
- `docs/contracts.md`: layout, types and every module signature. Frozen after wave 0.
- `docs/tasks.md`: the task DAG.
- `docs/lessons.md`: the beer-league failure modes as rules with tests. Every change respects
  them.
- `docs/wizzrobe-surface.md`: every Wizzrobe tool, who may call it, and whether the bot uses it.
  Check it before adding a tool to a responder.

## Building

- **The builder (the main Opus session) writes no code, tests, configs or prompts.** It writes
  task cards and `BUILD_STATUS.md`, runs git and gates, reads reports, and decides. Every code
  file comes from a subagent running one card.
- The builder dispatches W0, then each wave's cards in parallel. Each card uses the model named
  in `docs/tasks.md` and `isolation: "worktree"`. It merges, gates, fixes through fresh fixer
  agents, reviews and ships. Details are in `docs/build.md`.
- Plan limits (Claude Max 5x) and what they mean for card sizing, concurrency and resuming are in
  `docs/build.md`, "Plan constraints". Every card states the worker's budget.
- A worker touches only the files its card owns. It never changes a contract, `package.json`,
  `src/types.ts` or `src/errors.ts`, and it reports BLOCKED instead of improvising.
- One commit per task: `type(area): what`, with the Co-Authored-By trailer.
- Never weaken a test to make it pass.

## Public repo

- This repo is public. No secret ever goes in the tree: no keys, tokens, refresh tokens, OAuth
  client secrets, Discord bot tokens or real `.env` files. Everything comes from env vars, and
  `.env.example` lists the names with empty values.
- No personal data in fixtures or logs: no real player names beyond public display names, and
  nothing from check-in, emergency contacts or accommodations.
- One module (`src/config.ts`) reads `process.env`. Nothing else does.

## Wizzrobe rules

- Every call acts as a real person, the bot's account or a linked user's, and Wizzrobe enforces
  what that person may do. Never try to act for someone through another account.
- Write tools run only after a Confirm button press from the same Discord user, and only with that
  user's own token. Never with the bot's token.
- Never guess an id. `winner_id` and station keys are participation-row ids from `get_match`, not
  user ids. Read, then write.
- Times arrive in UTC. Convert to the community timezone before showing them. Reports already use
  the community clock.
- 120 requests a minute per token. Cache reads briefly; honor `Retry-After` on 429.
- Wizzrobe already DMs people about their own matches, crew slots and shifts. Do not duplicate
  those notifications.

## Code standards

- Strict TypeScript. Validate inputs at boundaries with zod. Fail loud; never swallow an error
  into a wrong answer.
- Permission checks live in code after routing. Never enforce access control in a prompt.
- All Anthropic calls go through `createMessage(purpose, ...)`:
  - the model ids live in its `MODELS` map;
  - it records usage and enforces the daily spend cap;
  - it reads text blocks by type, never `content[0]`.
- Keep the stable system prompt first and cached, and put the current time after it. A timestamp
  in the cached prefix kills the cache.
- Example phrasings in a prompt anchor the model hard. Describe routes; don't list sample
  questions.
- `npm run check` (typecheck, Biome, vitest, `scripts/check-rules.ts`) passes before every merge.

## Branch workflow

- Work on feature branches, PR into `main`. Feature PRs squash-merge into `main`. Production
  deploys from a versioned release branch (`release/v0.1` now), never from `main`. A new minor
  version gets a new `release/vX.Y` branch, set as Vercel's production branch. Never push to
  `main` or a release branch directly, never force-push.
- A release is a PR from `main` into the current `release/vX.Y` branch, merged with a merge commit
  (never squash, or the branches diverge). Every release bumps the patch version in
  `package.json` and `relay/package.json` on `main` first. The merged release commit is tagged
  `vX.Y.Z` and the tag is pushed.
- No CI and no GitHub Actions. The gate is `npm run check` (and the relay's build and tests when
  `relay/` changed), run locally before every merge, and the PR says so.
- Only the release branch deploys. Vercel's Ignored Build Step on the project,
  `[ "$VERCEL_ENV" = "production" ] && exit 1 || exit 0`, skips every push that isn't to the
  production branch, so `main` and feature branches never build. There are no preview
  deployments. Railway deploys the relay from the same release branch.

## Posting to Discord

- Personal answers (`/me`, linked actions) are ephemeral. Only schedule, stream and standings
  answers post publicly.
- `allowed_mentions` is always empty of `everyone`, `here` and roles.
- A new feature is tried in the test server before it reaches the SGL server.

## Writing rules

- Never use em dashes in any output: commits, PRs, comments, docs, code. Use commas, periods,
  colons or semicolons.
