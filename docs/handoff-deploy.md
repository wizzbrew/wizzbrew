# Handoff: deploying Wizzbrew v0.1

Written 2026-10-16 for whoever takes Wizzbrew live: Vince, a collaborator, or a later Claude
session. The steps themselves are in [deploy-checklist.md](deploy-checklist.md); this page is
the context around them: where things stand, what to settle first, what to watch, and how to back
out.

## Where it stands

- Production is **v0.1.12** (tag `v0.1.12`, 2026-10-17), live at `https://wizzbrew.vercel.app`
  from `release/v0.1` (Vercel project `wizzbrew`), with the relay on Railway (project `wizzbrew`,
  service `relay`, US East, rebuilt from every release push). The repo is `wizzbrew/wizzbrew` on
  GitHub, public. Every release since v0.1.1 bumped both package versions and carries a tag.
- The bot is installed in two servers, the test server and Vince's own, with the 10 slash
  commands registered to each (guild commands) and the relay allowlisted to one channel in each.
  It is not in the SGL server yet.
- Gate on `main`: 1,391 tests, the rules script and the relay's tests, all run locally before
  every merge. No CI by decision.
- Three pieces are live:
  - **Vercel:** slash commands, buttons, modals, OAuth callbacks and `/api/message`
    (`api/*.ts`, 300 s max duration in `vercel.json`).
  - **Railway:** the gateway relay in `relay/`, which forwards @mentions (user or role pings),
    DMs and replies to `/api/message`, and logs why it ignores a message that looked aimed at it.
  - **Upstash Redis:** one database: links, threads, pending actions, locks, spend, the kill
    switch, the DM log and counts, the prize pool and attendee caches.
- What it answers, beyond the schedule, live view, players, `/me`, crew and match actions:
  - **Game knowledge** (`src/game/`, `prompts/<game>/`): A Link to the Past (dungeons, overworld,
    items, the door randomizer's static key logic and the full per-location logic exported from
    the engine for no-glitch and HMG), Super Metroid (areas, bosses, items, Casual and Tournament
    rules per area) and the Zelda 1 Randomizer (levels, bosses, items, gate logic). A `game`
    route picks a routine (dungeon, logic, overworld, items, general) and loads only the slices a
    question needs, cached in layers for an hour. Rebuild with `npm run build:game`; re-export
    with the two Python tools under `tools/`.
  - **Event facts** (`prompts/event/sgl26.md`): dates, venue, hotel, tickets, links, on the help
    and tournaments routes; the Matcherino prize pool total live on help (5 minute cache); the
    Matcherino attendee list for "is X going" on the players route (20 minute cache, display
    names only).
  - **Trolling:** the voice's posture paragraph, the "not disclosed" rule, a code guard that
    replaces any answer quoting the instructions, and the bartender treatment for obvious trolls.
  - **DMs:** logged in Redis with a per-user daily cap (default 5); `/dmlog` for the owner.
- Brackets are still link-only. The Challonge client is parked ([backlog.md](backlog.md)); leave
  `CHALLONGE_API_KEY` empty.
- Unverified against real data until the tenant has matches: `list_matches`, `get_match` and
  `get_schedule` shapes, and therefore scheduling, crew slots and attendance-from-matches.

## Settle before starting

These need other people. Ask early; none of them are code.

1. **SG staff:** is a dedicated bot account allowed in Wizzrobe? If so, they create it or admit
   it to `sgl26`. The bot's read answers run as that account, so it should be a plain member, not
   staff.
2. **SG staff:** which Discord server for testing, and which SGL channels the bot may answer in
   (`RELAY_CHANNEL_IDS`). Default to one test channel first.
3. **Synack:** register the Wizzrobe OAuth client (or confirm self-service at
   `wizzrobe.synack.live/register` is fine) with both redirect URIs from checklist step 3.
4. **Synack:** turn on the brackets feature for `sgl26` (see the backlog). This doesn't block the
   deploy.

## Repo, access and secrets

- **GitHub:** the repo is public in the `wizzbrew` org (Vercel Hobby can't connect a private org
  repo). Give collaborators the **Write** role, not Admin. `main` and `release/v0.1` are protected:
  pull request required (zero approvals while Vince is the only developer; set it back to one
  when a collaborator joins), no force-push, no deletion. There is no CI by Vince's decision:
  `npm run check`, plus the relay build and tests when `relay/` changed, runs locally before every
  merge, and the PR description says it passed. The release branch deploys to production, so its
  PR is what keeps unreviewed code away from production secrets.
- **Releases:** feature PRs squash-merge into `main`. A release is a PR from `main` into
  `release/v0.1`, merged with a merge commit (never squash, or the branches diverge). Every
  release bumps the patch version in `package.json` and `relay/package.json` on `main` first, and
  the merged release commit is tagged `vX.Y.Z` and the tag pushed.
- The public-repo rules in CLAUDE.md still apply whether the repo is public or private: no secret
  in the tree, ever. `.env.example` holds names only; `src/config.ts` and `relay/src/config.ts`
  are the only readers of env.
- **Secrets live only in Vercel and Railway env vars** (and each developer's own
  `.env.local`, which git ignores). Don't add collaborators to the Vercel or Railway teams; team
  members can read env values.
- **Only the release branch builds.** The Ignored Build Step on the Vercel project skips every
  push that isn't to the production branch, so `main` and feature branches never deploy. Every
  variable is scoped to Production only, and there is one Upstash database, the project's,
  connected to Production only.
- Mark production values **Sensitive** in Vercel. Rotate any value that is ever pasted somewhere
  it shouldn't be.
- No GitHub Actions workflows, by Vince's decision. If that ever changes, keep production secrets
  out of Actions secrets: anyone with Write can add a workflow that reads them.

## Order

Follow [deploy-checklist.md](deploy-checklist.md) steps 1 to 11. These notes go with it:

- **Step 2 (Discord):** the **Message Content** intent must be ON, or the relay connects but sees
  empty messages. (An older note in plan.md said no privileged intents; the relay changed that.)
- **Step 3 (Wizzrobe):** `scripts/wizzrobe-login.ts` runs locally, signed in as the bot account,
  and needs `http://127.0.0.1:8976/callback` registered. It prints the refresh token once; paste
  it straight into Vercel.
- **Step 4 (Upstash):** one database, the project's, on Production only. No Preview database.
- **Step 5 (env):** production values go on Production only. `CHALLONGE_API_KEY` stays empty.
- **Step 6 (release flow):** production builds from `release/v0.1`. Bump the patch version in
  `package.json` and `relay/package.json` on `main` (squash PR), open a PR from `main` into
  `release/v0.1`, wait for `check` to pass, merge with a merge commit, then tag the merged commit
  `vX.Y.Z` and push the tag.
- **Step 6 (endpoint):** Discord PINGs the Interactions Endpoint and rejects it on a bad signature
  check, so an accepted URL proves `DISCORD_PUBLIC_KEY` and the deploy are right. `/api/health`
  should also answer.
- **Step 7:** register commands to the test guild first (`DISCORD_DEV_GUILD_ID` set). Go global
  only for the SGL server, in step 11.
- **Step 8 (Railway):** root directory `relay`, set on the service (Railway rejects
  `railway.json`); `RELAY_SECRET` must match Vercel byte for byte.
  A mismatch shows up as 401s on `/api/message` and the relay's "I can't answer right now" reply.
- **Step 9:** run every smoke test, including the link-hijack refusal (open someone else's link
  from a second Discord account; it must refuse and link nothing).

## Verify live (first hour in the test server)

- **Discord ids:** `get_match` still returned `discord_id` as a JSON number on 2026-10-15 (Synack
  says MCP is fixed; check it again). Linked askers are matched by Wizzrobe username, so `/me`
  works for them either way. Unlinked askers are matched by Discord id as a string; while any id
  comes back as a number, the bot says it can't tell which matches are theirs instead of guessing
  (`src/wizzrobe/mine.ts`). Confirm both cases.
- **Response shapes:** re-record the fixtures from real responses (add
  `my_reschedule_requests`, `my_equipment_checkouts`, `get_player_availability`, `get_stage`),
  then run `npm run check` again.
- **Evals:** `npm run eval` against the real router; the bar is 90% on the route.
- **Spend:** each request logs a spend line (`vercel logs`). `ANTHROPIC_DAILY_BUDGET_USD=5`
  caps the day; the workspace limit in the Console caps the month.
- **Wall clock:** a long tool loop should finish well under 300 s. Watch for "that took too long"
  in the logs.

## Running it

- **Pause:** set the Redis key `wb:v1:kill` (any value) in the Upstash console. Every entry
  point, slash commands, buttons and relayed messages alike, answers "Wizzbrew is paused right
  now." and does nothing else. Delete the key to resume. Try it once in the test server before
  going to SGL.
- **Staff alerts:** with `STAFF_ALERT_CHANNEL_ID` set, failures that aren't the user's post to
  that channel, at most once per event every 10 minutes.
- **Roll back the app:** in Vercel, promote the previous production deployment (or
  `vercel rollback`). Redis data needs no migration in v0.1.
- **Roll back the relay:** redeploy the previous deployment in Railway, or stop the service. With
  the relay down, slash commands still work; only @mentions, DMs and replies stop.
- **Revoke:** a leaked key gets rotated at its source (Console, Discord portal, Wizzrobe, Upstash),
  then updated in Vercel or Railway and redeployed. `TOKEN_ENCRYPTION_KEY` can't be rotated
  without re-linking everyone, because it encrypts the stored refresh tokens.

## People

- **Vince:** owner; approves pushes, deploys and anything that reaches the SGL server.
- **Synack:** Wizzrobe and its MCP server (OAuth client, features, the Discord id fix, bracket
  sync).
- **SG staff:** the `sgl26` community, the bot account, server and channel choices.

## Open as of v0.1.12

- **Before the SGL server:** SG staff pick the channel and a staff alert channel id
  (`STAFF_ALERT_CHANNEL_ID`), and decide whether the bot keeps reading Wizzrobe as Vince's account
  or gets a dedicated plain-member account. Synack: brackets on for `sgl26`, delete the orphaned
  OAuth client `8dd2c541...`, confirm `discord_id` is a string. Then checklist step 11 (install,
  restrict, register, pinned intro), and try the kill switch once.
- **First real match:** re-record the three match shapes from live responses and run the
  scheduling, crew and attendance paths once.
- **Optional:** `npm run eval` against the live router (needs a key in `.env.local`); the match
  procedure doc for the help route; HMG and Z1R logic beyond what is exported; a Wizzrobe match
  webhook relay for proactive channel posts; [backlog.md](backlog.md).
