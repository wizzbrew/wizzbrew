# Wizzrobe surface: what the bot can reach

Researched 2026-10-15 from three sources:

- the Wizzrobe MCP server's own tool list (`https://wizzrobe.synack.live/mcp`, 95 tools),
- the REST API spec (`https://wizzrobe.synack.live/api/openapi.json`, docs at `/api/docs`),
- the in-app help on `https://onsite.speedgaming.org/help` (SGL 2026's instance).

Re-check before building: the server is under active development and the tool list will move.

## SGL 2026 live findings (tested 2026-10-15)

Tested over the MCP as `homemadebeer`, user 206: a plain member, no roles, `can_write: true`.

- **Tenant:** `sgl26`, named "SpeedGaming Live 2026". Every tool call passes `tenant: "sgl26"`.
- **Features on** (from `whoami`): `ada_accommodations`, `challonge`, `community_events`,
  `emergency_contacts`, `equipment`, `event_check_in`, `event_info`, `feedback`, `payouts`,
  `volunteers`.
- **Features off:** Wizzrobe brackets (`list_brackets`, `list_bracket_entrants`,
  `get_bracket*`), async qualifiers (`list_async_qualifiers` and the rest), race rooms
  (`get_race_room`). Each answers `not_found: This feature is not enabled for this community.`
  SGL brackets live on Challonge; each tournament's `bracket_url` points there.
- **Works for a plain member:** `list_tournaments`, `get_tournament`, `list_stages`,
  `get_schedule`, `list_matches`, `get_match`, `list_tournament_signups`, `my_volunteer_shifts`,
  `get_user` (self), `list_randomizers`.
- **Staff-only answers:** `list_users` returns `forbidden: Staff access required`.
- **Errors arrive as tool errors whose text starts with a code**, not as HTTP statuses:
  `not_found: ...`, `forbidden: ...`, and presumably `unauthorized`, `rate_limited` /
  `invalid_request` and the like. `callTool` maps the code prefix to `WizzrobeError` status:
  `not_found` 404, `forbidden` 403, `unauthorized` 401, `invalid_request` 400, rate limit 429,
  anything else 500. Record any new codes seen in the live phase here.
- **Stages:** Earth (1) twitch.tv/SpeedGaming, Fire (2) SpeedGaming2, Water (3) SpeedGaming3,
  Air (4) SpeedGaming4.
- **Tournaments (15):** ALTTP Any% NMG (7), ALTTPR (9), ALTTPR Hybrid MG (8), Best of NES High
  Score (20) and Relay (19), Challonge Integration Test (2, Synack's fixture), DK64R (10),
  FFR (11), MMR (12), OoTR (13), SM Any% (14), SM Map Rando (15), SM DASH (16), Z1R (17),
  WWR (18). Signups close between 2026-10-19 and 2026-10-24 (UTC); ALTTPR had 35 entrants.
- **Matches:** only Synack's test matches so far (tournament 2). Statuses seen: `scheduled`,
  `checked_in`, `complete`.
- **Discord-id bug (reported 2026-10-15, assumed fixed soon):** `get_match` returns each
  player's `user.discord_id` as a JSON number. 18-digit ids lose precision through a JavaScript
  JSON parser (values came back ending in `...700`, `...220`, `...500`). Treat a numeric
  `discord_id` as unreliable and never match on it. After the fix, expect a string and match on
  it exactly.

### Response shapes (recorded, trimmed)

Source material for `tests/fixtures/wizzrobe/`. Fake ids, with the `discord_id` shown as the
string it should become.

```jsonc
// whoami
{"user_id":206,"username":"homemadebeer","display_name":null,"is_super_admin":false,"can_write":true,
 "tenants":[{"slug":"sgl26","name":"SpeedGaming Live 2026","roles":[],"features":["challonge","volunteers","..."]}]}

// list_tournaments (active_only) -> {"result":[...]}
{"id":9,"name":"A Link to the Past Randomizer","is_active":true,"tournament_format":"Groups to Single Elim, Bo1",
 "players_per_match":2,"event_start_date":null,"event_end_date":null}

// get_tournament
{"id":9,"name":"A Link to the Past Randomizer","description":"Admins: ...\nTrophies: ...","seed_generator":"alttpr",
 "is_active":true,"players_per_match":2,"bracket_url":"https://speedgaming.challonge.com/sgl26alttpr",
 "rules_url":"https://docs.google.com/...","tournament_format":"Groups to Single Elim, Bo1",
 "triforce_access_message":null,"randomizer_notes":null,"average_match_duration":90,"max_match_duration":120,
 "required_commentators":2,"required_trackers":1,"allow_player_match_requests":false,
 "event_start_date":null,"event_end_date":null,"tournament_hours":null,
 "signups_open_at":null,"signups_close_at":"2026-10-21T03:59:00Z","created_at":"...","updated_at":"..."}

// list_stages -> {"result":[...]}
{"id":1,"name":"Earth","is_active":true,"stream_url":"https://twitch.tv/SpeedGaming"}

// get_schedule(date) -> {"result":[{"stage":"Fire","matches":[...]}]}   (grouped by stage)
{"id":1,"tournament":"Challonge Integration Test","scheduled_at":"2026-10-16T17:00:00Z","status":"scheduled",
 "players":["Player One","Player Two"],"stage":"Fire","restream_url":"https://twitch.tv/SpeedGaming2"}

// list_matches -> {"result":[...]}   same compact shape; stage and restream_url may be null

// get_match
{"id":1,"tournament":{"id":2,"name":"...","description":"...","seed_generator":"alttpr","bracket_url":null,
  "rules_url":null,"tournament_format":null,"average_match_duration":60,"max_match_duration":90},
 "title":"Scheduled Match","stage":{"id":2,"name":"Fire","stream_url":"https://twitch.tv/SpeedGaming2"},
 "generated_seed":null,"scheduled_at":"2026-10-16T17:00:00Z","seated_at":null,"finished_at":null,
 "comment":"","needs_review":false,
 "players":[{"id":1,"user":{"id":5,"username":"player_one","display_name":"Player One",
   "discord_id":"100000000000000001","pronouns":null},"finish_rank":null,"assigned_station":null}],
 "commentators":[],
 "trackers":[{"id":3,"user":{"id":1,"username":"...","display_name":"...","discord_id":"...","pronouns":"he/him"},
   "approved":true}],
 "created_at":"...","updated_at":"..."}

// list_tournament_signups -> {"result":[...]}
{"id":9,"name":"A Link to the Past Randomizer","window":"open","enrolled":false,"entrant_count":35,
 "can_sign_up":false,"can_withdraw":false,"signups_open_at":null,"signups_close_at":"2026-10-21T03:59:00Z"}

// get_user (self)
{"id":206,"username":"homemadebeer","display_name":null,"discord_id":"...","is_active":true,"roles":[],
 "pronouns":null,"twitch_username":null,"racetime_username":null}

// list_randomizers -> {"result":[{"randomizer":"alttpr","supports_triforce_texts":true}, ...]}
// my_volunteer_shifts -> {"result":[]}
// errors: tool error text "not_found: This feature is not enabled for this community."
//                         "forbidden: Staff access required"
```

Note the wrappers: list tools return `{"result": [...]}`, single-object tools return the object.

## How identity and permissions work

- **Every call acts as one Wizzrobe user.** An MCP connection (OAuth) or a REST personal token
  (`wizzrobe_pat_...`) can do exactly what that user can do in the web app, no more. The server
  enforces it; the bot never has to.
- **Communities ("tenants").** Wizzrobe hosts many communities. Every MCP tool except `whoami`
  and `list_tenants` takes a `tenant` slug. A REST token is bound to one community when it is made.
  A `not_found` on a feature means that community has not turned the feature on.
- **Read vs write.** OAuth scopes are `wizzrobe:read` and `wizzrobe:write`. A read-only
  connection simply does not see the write tools. `whoami` reports `can_write`.
- **Self-only writes.** Every player or crew write acts on the caller and nobody else:
  `sign_up_for_tournament`, `signup_as_crew`, `acknowledge_match`, `offer_match_for_stream` and
  `submit_match_request` (the caller must be one of `player_ids`). So **the bot cannot schedule,
  sign up or acknowledge on behalf of another player**. Doing anything for a specific Discord user
  needs that user's own linked Wizzrobe token. `create_match` and `update_match` schedule anyone,
  but only for staff, schedulers or a tournament admin.
- **Times** come back in UTC (ISO 8601). Each community picks a display timezone; SGL 2026 shows
  `America/New_York`. Reports are the exception: they use the community clock with the offset.
  `create_match` / `submit_match_request` take date and time on the community clock.
- **Rate limit:** 120 requests a minute per token, and the same per network address. `429`
  carries `Retry-After`.
- **Ids are never guessed.** `winner_id` and station keys are participation-row ids
  (`get_match().players[].id`), not user ids. Read before writing.

Role words used below: **member** (any community member), **self** (acts on the caller),
**player** (a player in that match), **crew coord** (crew coordinator), **TA** (tournament admin),
**admin** (admin access), **staff**, **super admin** (platform-wide).

## MCP tools by area

The **Bot** column says how the bot uses each tool:

- **public**: the bot's own read-only account can answer it for anyone.
- **linked**: needs the asking user's own linked Wizzrobe token.
- **staff**: only if the linked user holds that role.
- **no**: out of scope for a Discord bot.

### Orientation

| Tool | Does | Who | Bot |
|---|---|---|---|
| `whoami` | Signed-in user, `can_write`, roles and enabled features per community | anyone | public (health check) |
| `list_tenants` | Communities you belong to, with roles and slugs | anyone | public (startup) |

### Schedule, matches, stages, streams

| Tool | Does | Who | Bot |
|---|---|---|---|
| `get_schedule` | One day's matches grouped by stage (date on community clock) | member | public |
| `list_matches` | Matches by tournament / stage / UTC window, compact | member | public |
| `get_match` | One match: players, seed, stage, approved crew | member | public |
| `list_stages` | Stages (restream channels / setups) | member | public |
| `get_stage` | One stage | member | public |
| `matches_active_at` | What is live at an instant | admin | staff (else derive from `list_matches`) |
| `list_match_crew` | Crew incl. pending signups | admin | staff |
| `get_race_room` | The racetime.gg room for a match, any state | member | off in sgl26 |
| `list_race_rooms` | All open race rooms | staff | staff |
| `list_race_room_profiles` | Saved racetime room configs | member | no |

### Player self-service

| Tool | Does | Who | Bot |
|---|---|---|---|
| `acknowledge_match` | "I've seen the time" (once) | player | linked |
| `offer_match_for_stream` / `withdraw_stream_offer` | Hint to staff that you'd be happy to be streamed | player | linked |
| `watch_match` / `unwatch_match` | Wizzrobe DMs you on every state change of a match you are not in | self | linked |
| `submit_match_request` | Book a match in a request-based tournament (you must be a player) | self | linked |
| `suggest_match_time` | Earliest slot all players are free, inside hours and room cap | member | linked |
| `my_reschedule_requests` | Your move/cancel requests and their outcome | self | linked |
| `list_tournament_signups` | Active tournaments with your signup state and `can_sign_up` | self | linked |
| `sign_up_for_tournament` / `withdraw_from_tournament` | Enter or leave (inside the signup window; Challonge-linked ones need a linked Challonge account) | self | linked |
| `my_volunteer_shifts` | Your published shifts | self | linked |
| `my_equipment_checkouts` | Gear you hold | self | linked |
| `get_player_availability` | Your blocked-out / preferred windows (others: staff) | self | linked |
| `get_user` | Your profile and roles (others: staff) | self | linked |

### Crew (commentators and trackers)

| Tool | Does | Who | Bot |
|---|---|---|---|
| `signup_as_crew` | Sign yourself up as `commentator` or `tracker`; may need approval | self | linked |
| `withdraw_crew_signup` | Take your signup back | self | linked |

### Tournaments, brackets, qualifiers

| Tool | Does | Who | Bot |
|---|---|---|---|
| `list_tournaments` | Tournaments, compact (`active_only`) | member | public |
| `get_tournament` | Full detail and config | member | public |
| `list_brackets` | A tournament's bracket stages | member | off in sgl26 |
| `get_bracket` | Format, lifecycle state, entrant count | member | off in sgl26 |
| `get_bracket_standings` | Live standings table | member | off in sgl26 |
| `list_bracket_matches` | Pairings by round with scores (null slot = waiting on earlier round) | member | off in sgl26 |
| `list_bracket_entrants` | Everyone entered, dropped included | member | off in sgl26 |
| `list_async_qualifiers` | Async qualifiers | member | off in sgl26 |
| `get_async_qualifier` | Config, pools, `results_public` | member | off in sgl26 |
| `get_async_qualifier_leaderboard` | Standings (hidden while open: `forbidden` = not public yet) | member | off in sgl26 |
| `list_async_qualifier_live_races` | Live races against a qualifier | qualifier admin | staff |
| `get_tournament_payouts` | Prize split with amounts | staff / TA | staff |
| `list_triforce_texts` | Triforce text moderation queue | staff / TA | staff |

### Seeds and randomizers

| Tool | Does | Who | Bot |
|---|---|---|---|
| `list_randomizers` | Randomizers this community can roll | member | public |
| `list_presets` / `get_preset` | Seed presets and their settings | preset manager | staff |
| `generate_match_seed` | Roll a match's seed and DM it to the players | admin / proctor | staff |

### Running matches (proctor and staff)

| Tool | Does | Who | Bot |
|---|---|---|---|
| `create_match` | Schedule a match for any players | staff / scheduler | staff |
| `update_match` | Move, re-crew, roll back lifecycle steps | staff | staff |
| `delete_match` | Irreversible; notifies everyone | staff | staff (double confirm) |
| `seat_match` -> `start_match` -> `finish_match` -> `confirm_match` | Lifecycle: checked in, started, finished, confirmed | proctor / staff | staff |
| `record_match_result` | Winner of a 2-player match (participation row id) | proctor / staff | staff |
| `set_match_review` | Flag / clear a contested result | proctor raises, admin clears | staff |
| `assign_match_stage` / `assign_match_stations` | Stage and station placement | staff | staff |
| `set_match_stream_candidate` | Mark a restream candidate | staff | staff |

### Volunteers

| Tool | Does | Who | Bot |
|---|---|---|---|
| `list_volunteer_positions` | Volunteer jobs | admin | staff |
| `list_volunteer_shifts` | Shifts in a window with assignees | admin | staff |
| `volunteer_coverage` | Filled vs needed per shift | admin | staff |
| `volunteer_hour_trends` | Scheduled vs checked-in hours | admin | staff |
| `check_in_volunteer` | Record a volunteer arrived | coordinator / staff | staff |

### Event check-in desk

| Tool | Does | Who | Bot |
|---|---|---|---|
| `list_check_in_events` | Check-in events you can work | desk | no |
| `get_check_in_roster` | Badges, lanyards, check-in state | desk | no |
| `check_in_attendee` / `undo_attendee_check_in` | Desk check-in | desk | no |
| `add_walk_up` | Add someone without a badge | staff | no |
| `link_attendee` / `unlink_attendee` | Match roster rows to accounts | desk | no |
| `sync_check_in_event` | Pull Matcherino sales now | desk | no |

The desk works on personal data (names, badges). Keep it out of Discord.

### Equipment

| Tool | Does | Who | Bot |
|---|---|---|---|
| `list_equipment` | Inventory and who holds what | member (check) | staff |
| `get_equipment` | One asset with checkout history | member (check) | staff |

### Reports (admin)

`capacity_forecast`, `stage_utilization`, `match_operations_report`, `crew_coverage_report`,
`crew_participation_trends`, `tournament_health`, `activity_trends`. All admin. Bot: staff, later.

### Staff and platform

| Tool | Does | Who | Bot |
|---|---|---|---|
| `list_users` | Community users, by role | staff | staff |
| `list_join_requests` / `approve_join_request` / `deny_join_request` | Membership queue | staff | no |
| `list_audit_log` | Who changed what | staff | no |
| `list_feedback` | Feedback queue | staff | no |
| `get_system_config` | Community config | staff | no |
| `list_webhooks` / `list_webhook_deliveries` | Outbound webhooks | staff | no |
| `list_service_health` | Racetime bots and Challonge link health | staff | no |
| `list_speedgaming_links` / `list_speedgaming_episodes` | SpeedGaming schedule import | sync admin | no |
| `telemetry_summary` / `telemetry_top` | App usage | staff | no |
| `runtime_stats` | Server load | super admin | no |

## In the REST API but not in the MCP

These player actions exist in the REST API (`/api/...`, Bearer token) and the web app, but have no
MCP tool yet. If the bot needs them, it calls REST with the user's token. The bot can also just
link the user to the right page in the web app.

- **Reschedule requests:** raise one (`POST /api/matches/{id}/reschedule-requests`), agree with your
  opponent's (`.../agree`), withdraw yours. The MCP only lists them.
- **Bracket scheduling:** your open matchups (`GET /api/brackets/my-open-matches`), book the next
  game (`POST /api/brackets/matches/{id}/games`). In a bracket tournament this is how a match gets
  a time; there is no MCP tool for it.
- **Availability:** set your blocked-out windows (`PUT /api/users/me/availability`), and
  volunteer availability (`PUT /api/volunteers/me/availability`).
- **Volunteers:** give a shift back (`DELETE /api/volunteers/me/assignments/{id}`), your hours
  against the comp tiers (`GET /api/volunteers/hours/me`), acknowledge an assignment.
- **Crew:** acknowledge your approved slot (`POST /api/crew/{type}/{id}/acknowledge`).
- **Watching:** the list of matches you watch (`GET /api/matches/watching`).
- **Notification preferences:** per-tournament follow levels.
- **Triforce texts:** submit one; **feedback:** submit and list your own.
- **Async qualifier runs:** draw, submit, forfeit, reattempt.
- **Profile:** display name, pronouns.

Open question: does REST accept an MCP OAuth access token, or only a `wizzrobe_pat_` token?
Test with one call before designing around either. Synack says (2026-10-15) the REST API covers
everything; tokens come from Profile, "API tokens & AI clients".

For `sgl26` specifically, the Wizzrobe brackets feature is off and Challonge is on. In the live
phase, check whether `GET /api/brackets/my-open-matches` and booking a game still serve
Challonge-linked matchups, or answer 404. Note also `allow_player_match_requests: false` on
ALTTPR, so `submit_match_request` is refused there: read the flag before offering it.

## Not in either

- **Community events** (meetups and side events on Home > Event > Community): no endpoint at all,
  only `community_event.*` webhooks.
- **The public Watch page** (`/live`, no sign-in): each stage's stream, what's on now and
  what's up next. There is no public API for it; the bot builds the same view from stages and the
  schedule.

## Webhooks (push instead of polling)

Staff can point an outbound webhook at a URL (Admin > Settings > Integrations > Webhooks), and it
is signed with a secret. Event families: `match.*`, `crew.*`, `bracket.*`, `tournament.*`,
`race_room.*`, `async_qualifier.*`, `volunteer.*`, `community_event.*`, `discord_event.*`,
`check_in_entrant.*`, `check_in_event.*`, `sg_sync.*`, `tenant.*`. A Vercel route could take
these and post "match moved" or "now live on stage 2" to a channel. This needs a staff member to
set it up, so it is a phase 3 idea.

## What Wizzrobe already does in Discord

Wizzrobe has its own bot that DMs people: being scheduled, moved or cancelled; crew approval;
volunteer shifts and reminders; race room open; seed ready; reschedule requests (with an Agree
button); and updates on matches you watch. Players and crew already get **personal
notifications**. Wizzbrew should not duplicate them. Its job is **questions and answers in the
server**: what's on, who's playing, standings, streams, how things work, and a handful of
self-service actions.
