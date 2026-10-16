# Deploy checklist

Do these in order. Each step says how to verify it. No value goes in the repo: every secret lives
only in Vercel or Railway env vars. Use a test server first; the live server comes last.

## 1. Anthropic

- In the Claude Console, create a workspace (for example `wizzbrew`) and set a monthly spend limit
  on it.
- Create an API key in that workspace. Copy it once. It becomes `ANTHROPIC_API_KEY`.
- Verify: the key shows under the workspace, and the limit is saved.

## 2. Discord application

- In the Developer Portal, create an app named Wizzbrew.
- Note the Application ID (`DISCORD_APPLICATION_ID`) and the Public Key (`DISCORD_PUBLIC_KEY`, 64
  hex characters). Reset the bot token once and copy it (`DISCORD_BOT_TOKEN`).
- OAuth2 page: copy the Client Secret (`DISCORD_CLIENT_SECRET`) and add the redirect
  `https://<vercel-domain>/api/oauth/discord` (`DISCORD_OAUTH_REDIRECT_URI`). Linking a
  Wizzrobe account first proves the browser is the same Discord user, so a shared link can't
  attach someone else's account.
- Bot page: turn the **Message Content** privileged intent ON. The relay needs it.
- Install scopes: `applications.commands bot`. Permissions: View Channel, Send Messages, Read
  Message History.
- Install it to the test server first. Copy the test server id (`DISCORD_DEV_GUILD_ID`).
- Optional: a fallback channel id for `SAFE_DEFAULT_CHANNEL_ID`.
- Verify: the bot appears in the test server's member list.

## 3. Wizzrobe

- Ask SG staff to admit the bot account to the `sgl26` community.
- Register an OAuth client at `https://wizzrobe.synack.live/register` with BOTH redirect URIs:
  `https://<vercel-domain>/api/oauth/callback` and `http://127.0.0.1:8976/callback`. This gives
  `WIZZROBE_OAUTH_CLIENT_ID` and `WIZZROBE_OAUTH_CLIENT_SECRET`. Set
  `WIZZROBE_OAUTH_REDIRECT_URI` to the Vercel callback.
- Run `scripts/wizzrobe-login.ts` once, locally, signed in as the bot account. It prints
  `WIZZROBE_BOT_REFRESH_TOKEN`.
- Verify: the script finishes without an error and prints a token.

## 4. Upstash Redis

- In the Vercel project, add Upstash Redis from the Marketplace. It injects `KV_REST_API_URL` and
  `KV_REST_API_TOKEN`.
- Verify: both names appear in the project's env vars.

## 5. Vercel project and env vars

- Push the repo to GitHub and import it in Vercel. Framework preset: Other.
- Set every name from `.env.example` in Production and Preview:

| Name | Source |
|---|---|
| `ANTHROPIC_API_KEY` | Step 1 |
| `ANTHROPIC_DAILY_BUDGET_USD` | `5` |
| `DISCORD_APPLICATION_ID` | Step 2 |
| `DISCORD_CLIENT_SECRET` | Step 2, OAuth2 page |
| `DISCORD_OAUTH_REDIRECT_URI` | `https://<vercel-domain>/api/oauth/discord` |
| `DISCORD_PUBLIC_KEY` | Step 2 |
| `DISCORD_BOT_TOKEN` | Step 2 |
| `DISCORD_DEV_GUILD_ID` | Step 2, test server id |
| `SAFE_DEFAULT_CHANNEL_ID` | Step 2, optional |
| `WIZZROBE_BASE_URL` | `https://onsite.speedgaming.org` |
| `WIZZROBE_MCP_URL` | `https://wizzrobe.synack.live/mcp` |
| `WIZZROBE_TENANT` | `sgl26` |
| `WIZZROBE_OAUTH_CLIENT_ID` | Step 3 |
| `WIZZROBE_OAUTH_CLIENT_SECRET` | Step 3 |
| `WIZZROBE_OAUTH_REDIRECT_URI` | `https://<vercel-domain>/api/oauth/callback` |
| `WIZZROBE_BOT_REFRESH_TOKEN` | Step 3 |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `KV_REST_API_URL` | Step 4 |
| `KV_REST_API_TOKEN` | Step 4 |
| `COMMUNITY_TIMEZONE` | `America/New_York` |
| `CHALLONGE_API_KEY` | Challonge account, read-only key, optional |
| `RELAY_SECRET` | `openssl rand -base64 32` (at least 32 characters); same value on Railway |
| `STAFF_ALERT_CHANNEL_ID` | A staff channel id, optional (step 10) |

- Verify: the Vercel env list has no empty required name.

## 6. Deploy and the Interactions Endpoint

- Push to `main`; Vercel builds.
- In the Discord portal, set the Interactions Endpoint URL to
  `https://<vercel-domain>/api/interactions`.
- Verify: Discord accepts the URL (it sends a PING and refuses on a bad signature check).
  `/api/health` also responds.

## 7. Register commands

- Run `npm run register` locally with `DISCORD_DEV_GUILD_ID` set (guild commands appear
  instantly). Drop the guild id only when going global.
- Verify: typing `/` in the test server lists the Wizzbrew commands.

## 8. Railway relay

- Create a Railway service from this repo with the root directory `relay`.
- Set `RELAY_SECRET` (same value as Vercel), `DISCORD_BOT_TOKEN`, `WIZZBREW_URL` (the https
  Vercel base URL) and `RELAY_CHANNEL_IDS` (comma-separated channel ids to answer in).
- Verify: the deploy log shows `relay ready`, and the bot shows online in Discord.

## 9. Smoke tests, in the test server

- `/live` returns what is on each stage.
- `/ask` with a schedule question answers.
- An @mention in an allowed channel answers.
- A reply to the bot's answer gets a follow-up answer.
- "connect me to sgl" starts the link flow privately: Discord asks you to authorize Wizzbrew
  (identify), then Wizzrobe asks you to log in; finishing it makes `/me` work, privately.
- Hand the link to a second account and open it there: it must refuse ("made for a different
  Discord account") and link nothing.
- A follow-up question in a reply chain sees the earlier turns.
- Verify with `vercel logs`: the route and the spend line appear for each request.

## 10. Ops

- Set `STAFF_ALERT_CHANNEL_ID` so failures and cap hits are posted to staff.
- Kill switch: set the key `wb:v1:kill` in Upstash to stop the bot; delete it to resume. Verify
  once in the test server.

## 11. Evals, then production

- Run `npm run eval` and read the results.
- Repeat step 2 (install), step 7 (without the dev guild id, to go global) and step 8 (channel
  ids) for the SGL server. A feature is tried in the test server before it reaches SGL.
