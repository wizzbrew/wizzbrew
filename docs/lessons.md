# Lessons from beer-league-bot

Wizzbrew is the third Discord + AI bot. Every rule below comes from a bug that shipped in
`alttpr-beer-league-bot` (two seasons, 234 commits). The commit is named so the story can be read.
Each lesson has a **rule** and a **test** that proves the rule holds. Task cards in
`docs/tasks.md` cite these by number. A reviewer checks every one before ship.

## Time

**L1. Every prompt gets the current time, and the time is never cached.**
- What happened: the router and chat prompts carried no date. The model told people to wait for a
  registration window that had already opened (`fix(prompts): give the bot a clock again`).
- Rule: one function, `nowBlock()` in `src/time/time.ts`, formats the current instant in the
  community timezone. Every prompt builder appends it after the cached prefix, never inside it.
- Test: the prompt builder output contains today's date, and the cached system block does not.

**L2. One time parser, one time formatter. Compare instants, never strings.**
- What happened: three copies of a time parse disagreed. One swallowed 12-hour times as
  unreadable, so the duplicate check went blind and the same match was booked twice
  (`fix(matches): compare match times as instants`).
- Rule: all parsing and formatting goes through `src/time/time.ts`. Wizzrobe gives UTC ISO
  strings; convert them to `Date` at the boundary and compare epoch millis.
- Test: a grep in CI. No `new Date(` string parsing and no `toLocale*` outside
  `src/time/`.

**L3. A colon-less 24-hour time is a time, not a year.**
- What happened: "2300" was read as the year 2300, answered as midnight, and the race room
  opened the night before (`fix(schedule): stop reading a bare military time as a year`).
- Rule: `parseUserDateTime` reads `HHMM` directly. Text with no hour, or that moves the day
  unexpectedly, is refused out loud, never defaulted to midnight.
- Test: `"2300"`, `"8pm"`, `"20:00"`, `"tomorrow 9"`, a date with no time (refused), and a DST
  boundary date in America/New_York.

**L4. Convert against the date in question, not today.**
- What happened: an epoch was converted with EST's offset on an EDT date, and the match went in
  an hour early (`fix(discord): decode timestamp markup`).
- Rule: use `Intl.DateTimeFormat` with the IANA zone for the specific instant. Never hand-apply
  an offset.
- Test: instants on both sides of the November and March changes.

**L5. Show times as Discord timestamps.**
- Rule: every time the bot shows is rendered `<t:EPOCH:f>` (plus `:R` where it helps), so each
  reader sees their own local time. The community-timezone text is only for prompts.
- Test: the render output for a match contains `<t:` with the right epoch.

## Discord input

**L6. Expand Discord markup before anything reads a message.**
- What happened: role mentions `<@&id>`, user mentions `<@id>` and `<t:EPOCH:f>` reached the
  router raw. A match booked by pinging team roles was rejected as unknown teams
  (`fix(discord): resolve mentions to names before routing`, `decode timestamp markup`).
- Rule: `normalizeInput()` in `src/discord/markup.ts` expands user, role and channel mentions to
  names (from the interaction's `resolved` data) and timestamps to ISO, in one pass. It is the
  only entry point, and every path calls it.
- Test: a string with all four markup kinds comes out readable.

**L7. The bot knows who "me" is.**
- What happened: "schedule me vs X" answered "no player found matching 'me'"
  (`fix(agents): three ways one scheduling conversation fell apart`).
- Rule: the responder context always carries the asker's Discord name and, when linked, their
  Wizzrobe user id and username. "me" and "my" resolve in code, not in the model.
- Test: a `/ask` "when is my next match" from a linked user reaches the responder with the user
  id filled.

**L8. Untrusted text is sanitized before it reaches a prompt.**
- Rule: user text, display names and anything Wizzrobe returns that a user wrote (match comments,
  display names) go through `sanitizeForPrompt()`. The system prompt states that tool results are
  data, not instructions, as defense in depth. It is never the only defense.
- Test: a prompt-injection string in a question does not change the route's permission level.

## Models

**L9. Thinking eats `max_tokens`.**
- What happened: Sonnet 5 thought through its whole 500-token budget and returned no text
  (`fix(agents): leave Sonnet room to think`).
- Rule: no call sets `max_tokens` under 4000. Control depth with `output_config.effort`. Read
  text blocks by type (`textOf()`), never `content[0]`.
- Test: `textOf` on a response whose first block is `thinking` returns the text.

**L10. Structured output, not "parse the JSON out of prose".**
- What happened: "Start over. Schedule..." drew prose instead of JSON, `json.loads` failed at
  character 0, and the user got an empty checklist (`three ways ... fell apart`).
- Rule: the router uses `output_config.format` with a JSON schema. A refusal or `max_tokens` stop
  is a typed error that becomes the `chat` route with confidence 0, and it is logged.
- Test: a fake response with `stop_reason: "refusal"` routes to `chat`.

**L11. Example phrasings in a prompt anchor the model.**
- What happened: listing three sample phrasings produced the first one six times out of six. The
  long form "confirm schedule" spread the same way (`ask for "confirm"`).
- Rule: describe routes and their boundaries. Never list sample user questions in a prompt.
- Test: review checklist item.

**L12. Price usage by the exact model id.**
- What happened: Sonnet 5 was priced at Sonnet 4.6's rate (`fix(usage): price Sonnet 5 at its own
  rate`).
- Rule: `PRICING` is keyed by the same ids as `MODELS`. An unknown model throws at startup.
- Test: every `MODELS` value has a `PRICING` entry.

**L13. Style rules that matter go in code.**
- What happened: the prompt banned em dashes, and 1 in 48 replies still had one
  (`fix(chat): strip em dashes the model emits`).
- Rule: `finalizeText()` replaces em and en dashes and enforces Discord's 2000-character limit by
  splitting, at the single point a reply leaves the bot.
- Test: the em dash is gone, and a 4500-character answer becomes 3 messages.

**L14. The voice is plain and helpful, never condescending or bitter.**
- What happened: the tavern voice read as condescending, then as bitter (`fix(personality)`
  twice).
- Rule: no persona voice in v1. Short, factual and friendly. The no-pandering rules apply.

## State and errors

**L15. State survives a deploy, and its timeout measures silence.**
- What happened: in-memory state was lost on deploy, so "confirm" got "Missing: everything". The
  TTL started at the first message and killed active conversations at 10 minutes
  (`let an active conversation keep its state alive`).
- Rule: pending actions and threads live in Redis. TTL slides on each touch. Confirming with
  nothing pending says "that request expired, ask again", never a blank form.
- Test: confirm after expiry gives that message; touching extends `expiresAt`.

**L16. An error caught where a decision is made becomes the wrong decision.**
- What happened: a Sheets 429 was swallowed into "tournament not active" and told to a racer
  (`fix(validation): stop reporting a sheet error as a closed tournament window`).
- Rule: Wizzrobe and Anthropic failures are typed errors (`src/errors.ts`) that propagate. The
  handler maps them to honest replies: "Wizzrobe is busy, try again in a minute", never "no matches
  today". No bare `catch {}` anywhere.
- Test: `FakeWizzrobe` returning 429 or 500 yields the busy reply, not an empty answer. Lint
  forbids empty catch blocks.

**L17. Name the missing permission instead of surfacing a 403.**
- What happened: the bot surfaced a raw 403 (`fix(discord): name the missing event permission`).
- Rule: a Wizzrobe 403 maps to "your Wizzrobe account can't do that (needs X)". A Discord 403
  names the permission the bot lacks.
- Test: a 403 fixture maps to the named message.

## Identity and resolution

**L18. Resolvers never guess.**
- What happened: "coop" auto-matched "COOP AD" over "COOP Mystery" because it was shorter
  (`close audit findings`).
- Rule: matching a tournament, player or stage name is exact, or uniquely by prefix, or the bot
  asks with buttons. A wrong match is worse than a question.
- Test: an ambiguous prefix returns `{kind: "ambiguous", options}`.

**L19. One helper answers "who is this person".**
- What happened: two code paths answered "is this the same person" differently, and the
  destructive one ran last (four bugs). Identity also drifted across rows and handles
  (`fix(identity)` x3).
- Rule: `src/wizzrobe/identity.ts` is the only place that maps a Discord user to a Wizzrobe user.
  It reads the link record, never a name match.
- Test: a grep. No other module reads link keys.

## Posting

**L20. A new posting path starts somewhere nobody sees.**
- What happened: an announcement defaulted to a public channel and announced itself to the
  league on first use (`fix(config): default every channel to one that faces nobody`).
- Rule: anything the bot posts unprompted (later: the webhook relay) goes to
  `SAFE_DEFAULT_CHANNEL_ID`. `allowed_mentions` is `{parse: []}` on every message.
- Test: the render output always carries `allowed_mentions: {parse: []}`.

**L21. A batch built to create is the wrong batch to delete from.**
- What happened: a reconciler deleted the Discord event of a race in progress.
- Rule: any cleanup asks its own wider question ("does Wizzrobe still know this at all"). It
  applies if Discord scheduled events or a cache reaper are added later.

## Code

**L22. No lazy or dynamic imports.**
- What happened: lazy imports hid signature drift, and two admin commands shipped broken.
- Rule: static imports only. `tsc --noEmit` strict in CI.

**L23. Mock at the boundary.**
- Rule: fakes exist for Redis, Anthropic, the Discord REST API and Wizzrobe (MCP and REST).
  Never mock the module under test.

**L24. Log what was parsed.**
- What happened: finding which field held an unresolvable name took a deploy and a second report
  (`leave Sonnet room to think`).
- Rule: log the router decision (route, confidence, params) and each responder's tool calls
  (names only) with a request id. Never log tokens or user text beyond 200 characters.
