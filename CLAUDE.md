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

- `plan.md`: architecture, routes, phases, open questions, deploy steps. Status lives there.
- `docs/wizzrobe-surface.md`: every Wizzrobe tool, who may call it, and whether the bot uses it.
  Check it before adding a tool to a responder.

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
- Run lint and tests before every commit.

## Branch workflow

- Work on feature branches, PR into `main`. `main` deploys to Vercel production. Never push to
  `main` directly, never force-push.
- Preview deployments use a separate Discord app or guild-scoped commands, never the live server.

## Posting to Discord

- Personal answers (`/me`, linked actions) are ephemeral. Only schedule, stream and standings
  answers post publicly.
- `allowed_mentions` is always empty of `everyone`, `here` and roles.
- A new feature is tried in the test server before it reaches the SGL server.

## Writing rules

- Never use em dashes in any output: commits, PRs, comments, docs, code. Use commas, periods,
  colons or semicolons.
