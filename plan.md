# Wizzbrew: plan

A Discord bot for SpeedGaming Live 2026 that answers questions about the event from Wizzrobe,
the onsite tool: the schedule, what's on stream, standings, players, crew, and how things work.
Linked users can also do a few things for themselves (sign up to commentate, acknowledge a match).
The name is Wizzrobe plus homebrew (after `homemadebeer`).

Status: plan only, nothing built. Written 2026-10-15.

## Shape

```
Discord slash command
  -> POST /api/interactions (Vercel function)
       verify Ed25519 signature, answer PING
       reply "thinking..." (deferred, type 5) within 3 seconds
       waitUntil(handle):
         Haiku router  -> { route, params, confidence }
         code: permission check for the route (linked? staff?)
         responder for the route (Sonnet, agentic, Wizzrobe tools)
         PATCH the deferred message with the answer
```

The beer-league bot uses the same split: a cheap router picks a route, then code checks
permissions, then a responder handles it. What differs here:

- **Wiring.** Beer-league is a Python gateway bot on Railway that reads @mentions. Vercel cannot
  hold a gateway connection, so Wizzbrew uses slash commands over the HTTP interactions endpoint.
- **Responders.** Beer-league responders are single-call JSON extractors. Wizzbrew's are real
  tool loops over Wizzrobe.
- **State.** Beer-league keeps state in memory. Wizzbrew keeps it in Redis.

### Stack

- TypeScript on Vercel (Node runtime), plain API routes, no Next.js pages. TypeScript fits Vercel
  best (`waitUntil` from `@vercel/functions`) and the Anthropic TS SDK has the tool runner and the
  MCP connector types.
- `@anthropic-ai/sdk`, `discord-interactions` (signature check), `@upstash/redis`, `zod`.
- Upstash Redis from the Vercel Marketplace for linked accounts, cache, conversation state and
  the spend counter.
- `@modelcontextprotocol/sdk` to call Wizzrobe tools directly when a user confirms a write.
- vitest, Biome, strict `tsc`.

### Models

All model ids live in one `MODELS` map, which is where to swap them.

| Purpose | Model | Why |
|---|---|---|
| router | `claude-haiku-5-5`, effort `low` | Classification. JSON via structured outputs (`output_config.format`). |
| responders | `claude-sonnet-5-5`, effort `medium` | Multi-step tool use, the same tier beer-league uses for agents. `claude-opus-5-5` is a one-line swap if answers are weak. |
| chat / help | `claude-haiku-5-5` | Short answers from the help summary, no tools. |

Every call goes through one `createMessage(purpose, ...)` wrapper, as in beer-league. The wrapper:

- records usage,
- enforces a daily dollar cap (`ANTHROPIC_DAILY_BUDGET_USD`, counter in Redis),
- reads text blocks by type and never takes `content[0]`, since a thinking block can come first.

The system prompt is split into a stable part (cached) and a volatile part (the current time).

## How the bot talks to Wizzrobe

Two identities:

1. **The bot's own account.** A dedicated Wizzrobe user (for example `wizzbrew`), joined to the
   SGL 2026 community (tenant `sgl26`), connected **read-only**. It answers everything marked
   *public* in `docs/wizzrobe-surface.md`: schedule, matches, stages with their stream links,
   tournaments (format, rules, Challonge bracket link, signup deadline) and randomizers. Its
   refresh token is an env var; the access token is refreshed and cached in Redis.

   It can also answer "when is my next match" **without** a link: `get_match` lists each
   player's Discord id. This depends on Synack's fix for the Discord-id precision bug (reported
   2026-10-15, assumed fixed soon; see the surface doc). Until it lands, the code treats a
   numeric `discord_id` as untrustworthy and asks the user to `/link`.
2. **Each user's own account, once linked.** `/link` sends the user through Wizzrobe's OAuth:
   - the server supports dynamic client registration, authorization code with PKCE S256, and
     refresh tokens;
   - the callback is `GET /api/oauth/callback`;
   - the refresh token is stored encrypted in Redis, keyed by Discord user id;
   - `/unlink` deletes it and revokes the token at `/revoke`.

   Actions then run *as that person*, and Wizzrobe enforces what they may do. This is the only way
   to act for a user. The bot cannot schedule, sign up or acknowledge for anyone else; see
   "Self-only writes" in the surface doc.

How responders call tools: the **MCP connector** on the Messages API.

- `mcp_servers: [{type: "url", url: WIZZROBE_MCP_URL, name: "wizzrobe", authorization_token}]`
  plus `tools: [{type: "mcp_toolset", mcp_server_name: "wizzrobe", default_config: {enabled: false}, configs: {<allowlist>}}]`,
  beta `mcp-client-2025-11-20`.
- Each responder turns on only its own tools (allowlist mode). The token is the bot's for public
  routes and the user's for linked routes.
- Anthropic's side calls Wizzrobe, so there is no tool code to maintain, and every new MCP tool is
  one allowlist line.

Fallback: REST custom tools. For the player actions the MCP lacks (reschedule requests, booking a
bracket game, availability), write a few tools that call `/api/...` with the user's token. If the
MCP path proves unreliable, the same `WizzrobeClient` can serve every route over REST.

Rules that live in code, not prompts:

- the tenant slug is fixed from env,
- ids are read, never guessed,
- UTC is converted to the community timezone before display,
- 429s are retried after `Retry-After`,
- reads are cached briefly to stay under 120 requests a minute.

## Discord surface

Slash commands, registered by `scripts/register-commands.ts`:

| Command | Does |
|---|---|
| `/ask question:` | Anything. Goes through the router. The main entry point. |
| `/schedule [day] [stage] [tournament]` | Direct shortcut to the schedule responder. |
| `/live` | What's on each stage right now and next, with stream links. |
| `/standings tournament:` | Standings from Challonge, with the bracket and rules links. |
| `/player name:` | A player's tournaments, next match, bracket position. |
| `/link`, `/unlink`, `/me` | Account linking; `/me` shows your matches, crew slots, shifts. |

- Answers about one person (`/me`, linked actions) are **ephemeral** (flag 64). Schedule and
  standings answers are public in the channel.
- Writes always show a **Confirm / Cancel button** first. The confirm handler re-checks everything
  and runs the action. Pending actions sit in Redis with a 10-minute TTL.
- Follow-ups: v1 is single-shot. v2 adds an "Ask a follow-up" button that opens a modal, with the
  thread's history keyed in Redis by message id.
- The app can also be **user-installable**, so `/ask` works in DMs.
- Free-form @mentions in channels would need a gateway process (Railway, as beer-league does).
  That is out of scope unless slash commands feel too stiff.

## Routes and responders

The router returns one of these routes. Tools in **bold** need a linked user; everything else
runs on the bot's read-only account.

| Route | Answers | Tools (allowlist) |
|---|---|---|
| `schedule` | "what's on Saturday", "when does X play", "what's on stage 2 next", match details, "when is my next match" (no link needed) | `get_schedule`, `list_matches`, `get_match`, `list_stages`, `get_stage`, `list_tournaments`, plus the client tool `matches_for_me` |
| `streams` | "what's live", "where do I watch the ALTTPR final", stream links per stage | `list_stages`, `get_stage`, `get_schedule`, `list_matches`, `get_match` |
| `standings` | brackets, standings, who's left, results | `list_tournaments`, `get_tournament`, `list_matches`, `get_match`, plus the Challonge tool `challonge_bracket` (below) |
| `players` | "who is X playing", "is X still in", X's next match | `list_matches`, `get_match`, `get_schedule`, `list_tournaments`, plus `challonge_bracket` |
| `tournaments` | formats, randomizers, signup windows | `list_tournaments`, `get_tournament`, `list_randomizers`, **`list_tournament_signups`** |
| `my_stuff` | my matches, crew slots, shifts, reschedule requests, gear | **`get_user`**, **`list_tournament_signups`**, **`my_volunteer_shifts`**, **`my_reschedule_requests`**, **`my_equipment_checkouts`**, **`get_player_availability`**, plus `list_matches` / `get_match` |
| `crew` | "which matches need commentators", "sign me up to track match N" | `list_matches`, `get_match`, `get_schedule`, **`signup_as_crew`**, **`withdraw_crew_signup`** |
| `player_actions` | acknowledge, offer for stream, watch, enter a tournament, book a match, suggest a time | **`acknowledge_match`**, **`offer_match_for_stream`**, **`withdraw_stream_offer`**, **`watch_match`**, **`unwatch_match`**, **`sign_up_for_tournament`**, **`withdraw_from_tournament`**, **`submit_match_request`**, **`suggest_match_time`**, plus REST reschedule and bracket-booking tools later |
| `help` | how acknowledging, check-in, crew approval, stations, seeds and reschedule requests work | no tools; a short summary of the in-app help, linking `onsite.speedgaming.org/help/<topic>` |
| `staff` (later) | reports, coverage, live board, for linked staff only | the admin read tools, gated on the user's role from `whoami` / `get_user` |
| `chat` | anything else, or low confidence | none; a short answer plus a nudge to `/ask` something specific |

Permission gate, in code, after routing: linked routes without a link reply "run `/link` first".
Staff routes check the user's roles.

### Standings come from Challonge

SGL 2026 runs its brackets on Challonge. Wizzrobe's own brackets, async qualifiers and race rooms
are switched off for `sgl26`; those tools answer "This feature is not enabled for this
community". Each tournament's `bracket_url` points at its Challonge bracket (for example
`https://speedgaming.challonge.com/sgl26alttpr`).

- **v1:** standings and "who's left" answers include the tournament's bracket link and rules
  link, plus what Wizzrobe knows: finished and upcoming matches and who played in them.
- **With a Challonge key:** one client tool, `challonge_bracket(tournament_id)`. It reads the
  Wizzrobe tournament's `bracket_url`, fetches participants and matches from the Challonge API
  (read-only, `CHALLONGE_API_KEY`), and returns a compact table: entrants, eliminated or alive,
  each round's results. It is cached for 2 minutes. The builder checks the current Challonge API
  docs before writing the card (subdomain tournaments are addressed as `<subdomain>-<url>`).
  Without the key, the tool returns the link only and the answer says so.

**Write tools never run inside the model's loop.** On write routes the responder gets one extra
tool, `propose_action`. When the model calls it, the loop stops, and the bot stores the proposal
and shows Confirm/Cancel. Only the Confirm press runs the write, deterministically, with that
user's token and no model in the path. The write tools in the table (the `WriteTool`
list in `docs/contracts.md`) are what `propose_action` may name. They are never enabled on the
connector, which only carries each route's read tools.

## Personality

Wizzbrew sounds like a friendly regular behind the bar at the event who knows the schedule cold
and is glad to help. Its character comes from warmth, not attitude. Beer-league's tavern voice
read as condescending and then bitter, and this avoids both by design (L14).

Always:
- Facts first, in plain words: the answer, then the detail that matters. Brief.
- Treat everyone as a capable adult. Never explain the obvious, never talk down, never scold.
- No sarcasm or jokes at anyone's expense, including losses, upsets, seeds or skill. Players are
  the point of the event.
- No flattery and no filler ("Great question", "Happy to help", "Let me know if").
- Never claims to be staff, speaks for staff, or promises what staff will decide.
- When Wizzrobe doesn't show something, say so in one line and point to where it might be.
  Never guess.
- No em or en dashes (also enforced in code, L13). Discord markdown only: short lines, bold for
  match or stage names when it helps scanning, bullets for three or more items. No headings or
  tables.

Flavor by register:

| Register | Used by | Flavor |
|---|---|---|
| `data` | schedule, streams, standings, players, tournaments, my_stuff, crew, player_actions | None. Just the answer, cleanly laid out. |
| `help` | help | Plain and practical. At most one light, friendly closing line; none is fine. |
| `chat` | chat | At most one homebrewing or taproom turn of phrase, only if it fits, never the same one twice in a conversation, never forced. Out-of-scope asks get a one-line "here's what I can help with". |

The voice text lists no example idioms or phrasings: a listed example becomes the one the model
uses every time (L11).

## Build

The build runs as one Opus builder dispatching parallel Sonnet and Haiku workers against frozen
contracts. Every task is its own commit, merged and gated wave by wave.

- `docs/build.md`: roles, model choice per task, branches and PRs, gates, fix loop, reviewers,
  and the kickoff prompt.
- `docs/contracts.md`: repo layout, shared types, every module signature, the request flow.
- `docs/tasks.md`: W0 (scaffold, one worker), waves 1-4 (27 tasks), review, live phase.
- `docs/lessons.md`: 24 rules from beer-league's shipped bugs, each with its test.

Everything builds and tests against fakes. Only the live phase needs real keys and the Wizzrobe
tenant.

Later, after v0.1:
- follow-up threads,
- a webhook receiver posting match changes to a channel (needs staff to configure),
- the staff route.

## Open questions

Settled on 2026-10-15, by testing the MCP as `homemadebeer` (a plain member):

- **Tenant:** `sgl26` ("SpeedGaming Live 2026"). The empty tenant list was a server bug; Synack
  fixed it the same day.
- **Stages carry stream links:** Earth, Fire, Water and Air map to twitch.tv/SpeedGaming,
  SpeedGaming2, SpeedGaming3 and SpeedGaming4. Each match also carries `restream_url`.
- **A plain member sees** every tournament, the full schedule and match list, match detail with
  approved crew, their own signup state per tournament, and randomizers. Staff tools answer
  "forbidden: Staff access required".
- **Features off for `sgl26`:** Wizzrobe brackets, async qualifiers, race rooms. Standings come
  from Challonge (above).

Still open:

1. **Discord-id precision bug** (reported 2026-10-15, assumed fixed soon): `get_match` returns
   `discord_id` as a JSON number, and 18-digit ids lose their last digits through a JavaScript
   parser. When it's fixed it should arrive as a string. The bot only matches on a string id
   (L19).
2. Does the MCP accept a `wizzrobe_pat_` token, and does REST accept an MCP OAuth token? Synack
   says the REST API is complete (token from Profile, "API tokens & AI clients"). This decides
   whether the bot's own account can use a simple PAT.
3. Is a dedicated bot account allowed? Ask SG staff before creating one and joining it to the
   community.
4. Challonge: whose API key, and is read-only access to `speedgaming.challonge.com` tournaments
   enough for the standings tool?
5. Which server, and which channels may the bot answer in? Default to a test channel first.

## Deploying (later, together)

You do these; I'll walk through each when we get there.

1. **Anthropic API key.** In the Claude Console (platform.claude.com), create a key in its own
   workspace (for example `wizzbrew`) and set a monthly spend limit on that workspace. Copy the key
   once; it goes only into Vercel env vars.
2. **Discord application.** In the Discord Developer Portal, create an app named Wizzbrew. Note:
   - the Application ID, the Public Key, and the Bot Token (reset it once, copy it);
   - no privileged intents are needed;
   - the install link uses scopes `applications.commands bot`, with permission to send messages
     and embeds.

   Install it to a test server first.
3. **Wizzrobe.**
   - Create the bot account and ask SG staff to admit it to the community.
   - Register an OAuth client at `https://wizzrobe.synack.live/register` with redirect URI
     `https://<vercel-domain>/api/oauth/callback`. That gives `WIZZROBE_OAUTH_CLIENT_ID` and
     `_SECRET`.
   - Run `scripts/wizzrobe-login.ts` once, locally, to sign the bot account in read-only. That
     gives `WIZZROBE_BOT_REFRESH_TOKEN`.
4. **GitHub.** Push the repo (public is fine: no secret is ever in the tree), then import it in
   Vercel. Framework preset: Other.
5. **Redis.** In the Vercel project, add Upstash Redis from the Marketplace. It injects its own
   env vars.
6. **Env vars.** In Vercel (Production and Preview), add everything in `.env.example`. Generate
   `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.
7. **Deploy.** Push to `main`; Vercel builds. Then in the Discord portal, set Interactions
   Endpoint URL to `https://<vercel-domain>/api/interactions`. Discord sends a PING and refuses the
   URL if verification fails, which makes it a good first test.
8. **Commands.** Run `npm run register` with `DISCORD_DEV_GUILD_ID` set (guild commands update
   instantly). Drop the guild id when going global.
9. **Smoke test.** `/ask what's on today` in the test server. `vercel logs` shows the router's
   route and the spend line.

Check the function duration limit for your Vercel plan before phase 2. A tool loop can run tens of
seconds, and the followup has to land within Discord's 15-minute interaction token window.
