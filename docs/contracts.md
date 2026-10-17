# Contracts

The interfaces every build task codes against. The builder writes these into the repo in wave 0:
types in `src/types.ts`, and every module below as a stub whose functions throw `NotImplemented`.
Then they are **frozen**. Parallel workers implement bodies; they never change a signature. If a
worker finds a contract wrong, it stops and reports. The builder changes the contract, commits,
and re-dispatches.

The builder may refine any of this in wave 0, before freezing. After wave 0, this file and the
code must agree.

## Repo layout

```
api/
  interactions.ts        POST: Discord interactions endpoint (Web Request -> Response)
  oauth/callback.ts      GET: Wizzrobe OAuth redirect target
  health.ts              GET: liveness + config sanity (no secrets in output)
src/
  config.ts              the only reader of process.env (zod-validated, lazy singleton)
  types.ts               shared types below
  errors.ts              typed errors below
  log.ts                 structured logger with request id (L24)
  time/time.ts           all time parsing and formatting (L1-L5)
  discord/verify.ts      Ed25519 request verification
  discord/markup.ts      normalizeInput, sanitizeForPrompt, finalizeText (L6, L8, L13)
  discord/render.ts      Answer -> Discord message payload(s)
  discord/components.ts  custom_id encode/decode for buttons
  discord/api.ts         Discord REST: edit original, followups, register commands
  discord/commands.ts    slash command definitions
  store/kv.ts            Kv interface + Upstash implementation
  store/keys.ts          every Redis key, in one place
  store/crypto.ts        AES-256-GCM seal/open for tokens at rest
  llm/models.ts          MODELS, PRICING (L12)
  llm/budget.ts          daily spend counter
  llm/client.ts          createMessage, textOf (L9)
  router/routes.ts       Route table: auth level, model, tool allowlist
  router/prompt.ts       router system prompt
  router/router.ts       routeQuestion
  wizzrobe/oauth.ts      PKCE, authorize URL, code exchange, refresh, revoke
  wizzrobe/tokens.ts     fresh access tokens for the bot and for linked users
  wizzrobe/identity.ts   Discord user -> linked Wizzrobe user (L19)
  wizzrobe/mcp.ts        connector params for responders + direct tools/call client
  wizzrobe/rest.ts       typed REST calls for the MCP gaps
  wizzrobe/resolve.ts    name -> id matching that never guesses (L18)
  wizzrobe/mine.ts       matchesForAsker: the asker's matches, one list_matches call per question
  challonge/challonge.ts read-only Challonge bracket summary for a Wizzrobe tournament
  responders/clientTools.ts  client tools the responder loop can run in code (challonge_bracket, matches_for_me)
  personality/voice.ts   Wizzbrew's voice: voice(register), registers data | help | chat
  responders/base.ts     runResponder: one tool loop, shared by all routes
  responders/specs.ts    per-route prompt + allowlist + output rules
  actions/pending.ts     pending write actions in Redis (L15)
  actions/execute.ts     run a confirmed action with the user's token
  handlers/dispatch.ts   interaction type -> handler
  handlers/ask.ts        the /ask pipeline
  handlers/shortcuts.ts  /schedule /live /standings /player -> ask pipeline with a fixed route
  handlers/account.ts    link and unlink (one handler for slash and plain words)
  handlers/component.ts  button presses (confirm, cancel, disambiguation)
scripts/
  register-commands.ts   PUT commands (guild if DISCORD_DEV_GUILD_ID set)
  wizzrobe-login.ts      one-time local OAuth for the bot account -> prints refresh token
  sim-interaction.ts     sign and POST a fake interaction to a local endpoint
  check-rules.ts         CI greps: L2, L19, no em dashes, no env reads outside config
tests/
  fakes/                 FakeKv, FakeAnthropic, FakeDiscordApi, FakeWizzrobe
  fixtures/wizzrobe/     JSON shaped from the OpenAPI schemas
  unit/  integration/  e2e/
evals/
  questions.jsonl        fixed question set with expected route (+ expected facts later)
  run.ts                 runs router (and later responders) against them, prints a table
relay/                   the Railway gateway relay (its own package; see "Relay")
api/message.ts           POST: signed relay messages (HMAC)
api/oauth/discord.ts     GET: Discord identity check during linking
src/handlers/{ask,deliver,account,message}.ts, src/responders/direct.ts, src/ops/{alerts,rate}.ts
.env.example             every env var name, empty values
.gitignore               node_modules, .env*, .vercel, .idea, *.iml, .claude/worktrees
vercel.json              maxDuration 300 for api/**/*.ts (the Hobby maximum; Pro allows 800)
```

`tests/fakes/` holds `kv.ts`, `anthropic.ts`, `discord.ts`, `wizzrobe.ts`, `challonge.ts`, `fetch.ts`.
`tests/fixtures/challonge/` holds the Challonge v2.1 fixtures.

## Conventions (refined in wave 0, frozen with the rest)

- ESM (`"type": "module"`), `module` and `moduleResolution` `NodeNext`. Every relative import ends
  in `.js` (Vercel runs the compiled files as Node ESM, which needs the extension; NodeNext makes
  `tsc` enforce it).
- `discord-api-types` is a dev dependency: import from it with `import type` only. Use numeric
  literals for interaction and component types at runtime.
- Boundary modules expose one test seam each, named `set<Thing>ForTests(x | null)`; `null`
  restores the real implementation. Tests inject fakes through these, never through `vi.mock` of
  the module under test (L23).
- Scripts (`scripts/*.ts`, `evals/run.ts`) read configuration through `configFor(...)`, never
  `process.env`.

## Shared types (`src/types.ts`)

```ts
export type Route =
  | "schedule" | "streams" | "standings" | "players" | "tournaments"
  | "my_stuff" | "crew" | "player_actions" | "help" | "staff" | "chat"
  | "live" | "account";                  // added 2026-10-15: direct live answer; link or unlink by name

export type AuthLevel = "public" | "linked" | "staff";

export interface RoutingDecision {
  route: Route;
  confidence: number;               // 0..1
  params: {
    day?: string;                   // YYYY-MM-DD in community tz, resolved in code from text
    tournament?: string;            // raw name as said; resolved later (L18)
    player?: string;
    stage?: string;
    matchId?: number;
    accountAction?: "link" | "unlink";   // route "account" only
  };
  reason: string;                   // one short line, logged (L24)
}

export interface Asker {
  discordUserId: string;
  discordName: string;
  guildId: string | null;
  channelId: string;
  linked: LinkedAccount | null;     // filled by identity.ts (L7, L19)
}

export interface LinkedAccount {
  wizzrobeUserId: number;
  wizzrobeUsername: string;
  roles: string[];                  // from whoami/get_user, cached
  canWrite: boolean;
}

export interface AskContext {
  requestId: string;
  asker: Asker;
  question: string;                 // already normalizeInput()'d
  now: Date;
  ephemeral: boolean;
  history: ConversationTurn[];       // earlier turns of this thread, oldest first (empty for a new question)
}

export interface ConversationTurn { role: "user" | "assistant"; text: string }

export type ReplyTarget =             // where an answer goes (added 2026-10-15, hybrid model)
  | { kind: "interaction"; token: string; ephemeral: boolean }   // the deferred reply; ephemeral = the deferral's visibility
  | { kind: "message"; channelId: string; messageId: string };  // reply under a relayed message; never ephemeral

export interface RelayMessage {       // what the relay POSTs to /api/message
  messageId: string;
  channelId: string;
  guildId: string | null;
  isDm: boolean;
  author: { id: string; username: string; globalName: string | null; nick: string | null };
  content: string;                    // bot mention removed, other mentions expanded to names by the relay
  chain: { authorId: string; authorName: string; isBot: boolean; content: string }[];   // reply chain, oldest first, at most 10
}

export interface Answer {
  text: string;                     // markdown, finalizeText() applied at render
  embeds?: DiscordEmbed[];
  proposedAction?: ProposedAction;  // write routes only; rendered as Confirm/Cancel
  choices?: { label: string; value: string }[];  // disambiguation buttons (L18)
  ephemeral: boolean;
}

export interface ProposedAction {
  tool: WriteTool;                  // allowlisted write tool name
  args: Record<string, unknown>;    // validated against the tool's zod schema
  summary: string;                  // what the user is confirming, plain words, with <t:> times
}

export type WriteTool =
  | "signup_as_crew" | "withdraw_crew_signup"
  | "acknowledge_match" | "offer_match_for_stream" | "withdraw_stream_offer"
  | "watch_match" | "unwatch_match"
  | "sign_up_for_tournament" | "withdraw_from_tournament"
  | "submit_match_request"
  | "rest_create_reschedule_request" | "rest_book_bracket_game";

export interface PendingAction extends ProposedAction {
  id: string;
  discordUserId: string;            // only this user may confirm
  createdAt: number;
  expiresAt: number;                // sliding (L15)
}

export type ResolveResult<T> =
  | { kind: "match"; value: T }
  | { kind: "ambiguous"; options: T[] }
  | { kind: "none" };

export type DiscordEmbed = APIEmbed;  // import type { APIEmbed } from "discord-api-types/v10"

export interface LinkRecord {         // stored at keys.link(discordUserId) as JSON
  sealedRefreshToken: string;         // seal()ed; never logged
  wizzrobeUserId: number;
  username: string;
  roles: string[];
  canWrite: boolean;
  linkedAt: number;                   // epoch ms
  rolesCheckedAt: number;             // epoch ms; roles refresh at most every 10 minutes
}

export interface ThreadRecord {       // one conversation (follow-ups and choices), keys.thread(id), sliding 30 min TTL (L15)
  id: string;
  discordUserId: string;              // only this user may follow up or pick a choice
  question: string;                   // the latest normalized question
  turns: ConversationTurn[];          // last 6 turns, oldest first, each text capped at 1500 chars
  decision: RoutingDecision;
  ephemeral: boolean;
  held?: { answer: Answer; pendingId?: string };   // a private answer waiting behind "Show me privately"
  createdAt: number;
  expiresAt: number;
}
```

The raw interaction types come from `discord-api-types/v10` (dev dependency, `import type`
only).

## Errors (`src/errors.ts`)

```ts
export class NotImplemented extends Error {}
export class WizzrobeError extends Error {
  constructor(public status: number, public detail: string, public retryAfterSec?: number) { super(detail); }
}                                     // 401 expired link, 403 forbidden, 404 not found/feature off, 429, 5xx
export class NotLinkedError extends Error {}
export class BudgetExceededError extends Error {}
export class ModelOutputError extends Error {   // refusal, max_tokens, schema failure (L10)
  constructor(public stopReason: string, message: string) { super(message); }
}
export class UserInputError extends Error {}     // e.g. unparseable time (L3); message is shown to the user
export class DiscordError extends Error {        // Discord REST failure; 403 names the missing permission (L17)
  constructor(public status: number, message: string) { super(message); }
}
export function userMessageFor(err: unknown): string;   // the one place errors become replies (L16, L17)
```

`userMessageFor` maps, in this order (no em dashes, no raw status codes):

| Error | Reply |
|---|---|
| `UserInputError` | its own message |
| `NotLinkedError` | its message if non-empty, else "Ask me to link your Wizzrobe account first (or use /link)." |
| `BudgetExceededError` | "I've hit today's usage limit. Try again tomorrow." |
| `WizzrobeError` 429 | "Wizzrobe is busy, try again in a minute." |
| `WizzrobeError` 401 | "Your Wizzrobe link expired. Ask me to link you again (or use /link)." |
| `WizzrobeError` 403 | "Your Wizzrobe account can't do that (`<detail>`)." |
| `WizzrobeError` 404, detail contains "not enabled" | "That feature is not turned on for this event." |
| `WizzrobeError` 404, otherwise | "Wizzrobe couldn't find that." |
| `WizzrobeError` 400 | "Wizzrobe turned that down: `<detail>`" |
| `WizzrobeError` other | "Wizzrobe is having trouble right now. Try again in a minute." |
| `ModelOutputError` | "I couldn't put an answer together for that. Try asking another way." |
| `DiscordError` | "I couldn't post that in Discord (`<message>`)." |
| anything else | "Something went wrong on my side. Try again in a minute." |

## Module signatures

```ts
// config.ts
export interface Config {
  anthropicApiKey: string;              // ANTHROPIC_API_KEY
  anthropicDailyBudgetUsd: number;      // ANTHROPIC_DAILY_BUDGET_USD, positive
  discordApplicationId: string;         // DISCORD_APPLICATION_ID
  discordPublicKey: string;             // DISCORD_PUBLIC_KEY, 64 hex chars
  discordBotToken: string;              // DISCORD_BOT_TOKEN
  discordDevGuildId: string | null;     // DISCORD_DEV_GUILD_ID, optional
  safeDefaultChannelId: string | null;  // SAFE_DEFAULT_CHANNEL_ID, optional (L20)
  wizzrobeBaseUrl: string;              // WIZZROBE_BASE_URL, e.g. https://wizzrobe.synack.live
  wizzrobeMcpUrl: string;               // WIZZROBE_MCP_URL, e.g. https://wizzrobe.synack.live/mcp
  wizzrobeTenant: string;               // WIZZROBE_TENANT, sgl26
  wizzrobeOauthClientId: string;        // WIZZROBE_OAUTH_CLIENT_ID
  wizzrobeOauthClientSecret: string;    // WIZZROBE_OAUTH_CLIENT_SECRET
  wizzrobeOauthRedirectUri: string;     // WIZZROBE_OAUTH_REDIRECT_URI, https://<domain>/api/oauth/callback
  wizzrobeBotRefreshToken: string;      // WIZZROBE_BOT_REFRESH_TOKEN
  tokenEncryptionKey: string;           // TOKEN_ENCRYPTION_KEY, base64 of exactly 32 bytes
  kvRestApiUrl: string;                 // KV_REST_API_URL (injected by the Vercel Upstash integration)
  kvRestApiToken: string;               // KV_REST_API_TOKEN (same)
  communityTimezone: string;            // COMMUNITY_TIMEZONE, IANA zone, e.g. America/New_York
  challongeApiKey: string | null;       // CHALLONGE_API_KEY, optional
  relaySecret: string;                  // RELAY_SECRET, at least 32 chars, shared with the relay
  staffAlertChannelId: string | null;   // STAFF_ALERT_CHANNEL_ID, optional
}
export function config(): Config;                        // validates every var at first use, then caches
export function configFor<K extends keyof Config>(...keys: K[]): Pick<Config, K>;   // validates only these (scripts)
export function checkConfig(): { valid: boolean; problems: string[] };              // problems name variables, never values
export function resetConfigForTests(): void;
// Optional vars treat "" as absent. Errors name the env var and the rule, never the value.

// log.ts
export function log(level: "info" | "warn" | "error", event: string, fields?: Record<string, unknown>): void;
// One JSON line on stdout (stderr for error): {ts, level, event, ...fields}. Any string field
// longer than 200 chars is clipped (L24). Fields whose key matches
// /token|secret|authorization|password|api_?key|refresh/i become "[redacted]".
export function clip(text: string, max?: number): string;   // default 200, appends "..." when cut

// time/time.ts
export function nowBlock(now: Date): string;             // "Current time: Thu 2026-10-15 20:14 America/New_York"
export function parseWizzrobeTime(iso: string): Date;
export function discordTimestamp(d: Date, style?: "f" | "F" | "t" | "R"): string;
export function communityDate(d: Date): string;          // YYYY-MM-DD in community tz
export function parseUserDateTime(text: string, now: Date): { date: string; time: string; instant: Date };
                                                         // community clock; throws UserInputError (L3)
export function parseUserDate(text: string, now: Date): string;   // date words only -> YYYY-MM-DD; UserInputError (added before wave 1)
export function dayWindowUtc(date: string): { start: Date; end: Date };   // community day -> UTC bounds

// discord/verify.ts
export function verifyDiscordRequest(rawBody: string, signature: string, timestamp: string, publicKey: string): Promise<boolean>;

// discord/markup.ts
export function normalizeInput(text: string, resolved?: APIInteractionDataResolved): string;   // L6
export function sanitizeForPrompt(text: string, maxLen?: number): string;                      // L8
export function finalizeText(text: string): string[];   // dash-free, split <= 2000 chars (L13)

// discord/render.ts
export function renderAnswer(a: Answer, ids?: { pendingId?: string; threadId?: string }): RESTPatchAPIInteractionOriginalResponseJSONBody[];
// pendingId -> Confirm/Cancel buttons, plus "Change something" when threadId is given;
// threadId with choices -> one "choose" button per choice; threadId without choices or
// pendingId -> one "Ask a follow-up" button
export function renderPrivateStub(threadId: string): RESTPatchAPIInteractionOriginalResponseJSONBody;
// "This one is just for you." plus a "Show me privately" button (kind private)
export function renderError(message: string, ephemeral: boolean): RESTPatchAPIInteractionOriginalResponseJSONBody;
// every payload carries allowed_mentions: { parse: [] } (L20)

// discord/commands.ts (added before wave 1)
export type CommandName = "ask" | "schedule" | "live" | "standings" | "player" | "link" | "unlink" | "me";
export const COMMANDS: RESTPostAPIChatInputApplicationCommandsJSONBody[];   // what register-commands PUTs
// /player takes `name` (string) and an optional `user` (type 6, a Discord user); a user option resolves
// through the interaction's resolved data, so mentions are never lost.

// discord/components.ts
export type ComponentAction =
  | { kind: "confirm"; pendingId: string }
  | { kind: "cancel"; pendingId: string }
  | { kind: "choose"; threadId: string; value: string }
  | { kind: "followup"; threadId: string }               // opens the follow-up modal
  | { kind: "change"; pendingId: string; threadId: string }   // cancels the proposal, opens the modal
  | { kind: "private"; threadId: string };               // shows the held answer ephemerally (owner only)
export function encodeCustomId(a: ComponentAction): string;   // <= 100 chars
export function decodeCustomId(id: string): ComponentAction | null;

// discord/api.ts
export interface DiscordApi {
  editOriginal(token: string, body: unknown): Promise<void>;
  followup(token: string, body: unknown): Promise<void>;
  registerCommands(commands: unknown[], guildId?: string): Promise<void>;
  postMessage(channelId: string, body: unknown, replyToMessageId?: string): Promise<void>;
  // bot token; POST /channels/{id}/messages with message_reference {message_id, fail_if_not_exists: false}
}
export function discordApi(): DiscordApi;
export function setDiscordApiForTests(d: DiscordApi | null): void;
// Failures throw DiscordError(status, message); a 403 message names the missing permission.

// store/kv.ts
export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrByFloat(key: string, by: number, ttlSec?: number): Promise<number>;
  expire(key: string, ttlSec: number): Promise<void>;
  take<T>(key: string): Promise<T | null>;                              // atomic get and delete (GETDEL)
  setIfAbsent<T>(key: string, value: T, ttlSec: number): Promise<boolean>;   // SET NX EX; true when set
}
export function kv(): Kv;                        // Upstash, lazy singleton
export function setKvForTests(k: Kv | null): void;

// store/keys.ts
export const keys: {
  link(discordUserId: string): string;           // LinkRecord JSON (its refresh token is sealed)
  oauthState(state: string): string;             // PKCE verifier + discord user, 10 min
  botToken(): string;                            // cached bot access token
  userToken(discordUserId: string): string;      // cached user access token
  pending(id: string): string;                   // PendingAction
  thread(id: string): string;                    // disambiguation / follow-up context
  spend(day: string): string;                    // daily USD
  cache(scope: string, hash: string): string;    // short-lived Wizzrobe read cache
  lock(discordUserId: string): string;           // per-user in-flight lock, 120 s
  kill(): string;                                // kill switch: any value pauses the bot
  alert(event: string): string;                  // staff-alert rate limit, 600 s
};

// store/crypto.ts
export function seal(plaintext: string): Promise<string>;     // AES-256-GCM, TOKEN_ENCRYPTION_KEY
export function open(sealed: string): Promise<string>;

// llm/models.ts
export const MODELS: { router: "claude-haiku-5-5"; responder: "claude-sonnet-5-5"; chat: "claude-sonnet-5-5" };
export const PRICING: Record<string, { inPerM: number; outPerM: number; cacheReadPerM: number; cacheWritePerM: number }>;

// llm/budget.ts
export function assertUnderBudget(now: Date): Promise<void>;   // throws BudgetExceededError
export function recordSpend(model: string, usage: BetaUsage, now: Date): Promise<number>;   // USD of this call

// llm/client.ts
// SDK types come from "@anthropic-ai/sdk/resources/beta/messages/messages": BetaMessage,
// BetaUsage, BetaTool, BetaContentBlock, and the non-streaming create params (written here as
// BetaMessageCreateParams; W0 aliases whatever the installed SDK names it).
export type Purpose = keyof typeof MODELS;
export interface AnthropicLike {
  beta: { messages: { create(params: BetaMessageCreateParams & { betas?: string[] }, options?: { timeout?: number }): Promise<BetaMessage> } };
}
export function createMessage(purpose: Purpose, params: Omit<BetaMessageCreateParams, "model"> & { betas?: string[] }, ctx: { requestId: string; now: Date; deadline?: number }): Promise<BetaMessage>;
// deadline (epoch ms, added in review): the call's request timeout is min(120 s, deadline - now); at or past it -> ModelOutputError("timeout")
export function textOf(msg: BetaMessage): string;              // L9
export function setAnthropicForTests(c: AnthropicLike | null): void;

// router/routes.ts
export type ClientTool = "challonge_bracket" | "matches_for_me";
export interface RouteSpec {
  route: Route; auth: AuthLevel;
  readTools: string[];          // MCP read tools on the connector (allowlist)
  clientTools: ClientTool[];    // tools the loop runs in code (responders/clientTools.ts)
  writeTools: WriteTool[];      // what propose_action may name; never on the connector
  description: string; ephemeral: boolean;
}
export const ROUTES: Record<Route, RouteSpec>;

// router/prompt.ts
export const ROUTER_PROMPT: string;   // stable system text, cached; only router.ts imports this file (T10 may add exports here)

// router/router.ts
export function routeQuestion(ctx: AskContext): Promise<RoutingDecision>;   // failures -> chat, confidence 0 (L10)

// wizzrobe/oauth.ts
export function startLink(discordUserId: string): Promise<{ url: string }>;     // stores state + verifier
export function finishLink(code: string, state: string): Promise<{ discordUserId: string }>;
export function refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;
export function revoke(token: string): Promise<void>;

// wizzrobe/tokens.ts
export function botAccessToken(): Promise<string>;
export function userAccessToken(discordUserId: string): Promise<string>;   // throws NotLinkedError

// wizzrobe/identity.ts
export function loadAsker(i: APIInteraction): Promise<Asker>;              // the only reader of link keys (L19)
export function loadAskerFromMessage(m: RelayMessage): Promise<Asker>;    // same link and role logic as loadAsker
export function getLink(discordUserId: string): Promise<LinkRecord | null>;
export function saveLink(discordUserId: string, rec: LinkRecord): Promise<void>;
export function deleteLink(discordUserId: string): Promise<void>;

// wizzrobe/mcp.ts
export function connectorParams(token: string, readTools: string[]): { mcp_servers: unknown[]; tools: unknown[]; betas: string[] };
export function callTool(token: string, name: string, args: Record<string, unknown>): Promise<unknown>;   // direct MCP tools/call, used for confirmed writes and code-side reads
export interface RawToolResult { isError: boolean; text: string }       // the tool result's text content
export type RawToolCall = (token: string, name: string, args: Record<string, unknown>) => Promise<RawToolResult>;
export function setRawToolCallForTests(f: RawToolCall | null): void;   // real: MCP SDK Client over StreamableHTTP
// A transport-level HTTP failure makes the raw call throw WizzrobeError(status, detail, retryAfterSec).
// Tool errors arrive as text "<code>: <message>". Map: not_found 404, forbidden 403,
// unauthorized 401, invalid_request 400, rate limit 429, anything else 500 (keep the message as
// detail). List tools return {"result": [...]}; callTool returns the parsed JSON as-is.

// wizzrobe/rest.ts
export function createRescheduleRequest(token: string, matchId: number, body: { kind: "reschedule" | "cancel"; reason: string; proposedAt?: string }): Promise<unknown>;
// POST /api/matches/{id}/reschedule-requests {kind, reason, proposed_at (ISO UTC, omitted for cancel)} -> 201
export function bookBracketGame(token: string, bracketMatchId: number, body: { scheduledDate: string; scheduledTime: string; comment?: string }): Promise<unknown>;
// POST /api/brackets/matches/{id}/games {scheduled_date YYYY-MM-DD, scheduled_time HH:MM, both community clock} -> 201
export function myOpenBracketMatches(token: string, tournamentId?: number): Promise<unknown[]>;
// GET /api/brackets/my-open-matches[?tournament_id=] -> array. Native brackets are off for sgl26 (404).

// wizzrobe/resolve.ts
export function resolveByName<T>(input: string, items: T[], nameOf: (t: T) => string): ResolveResult<T>;   // L18

// wizzrobe/mine.ts
export interface MyMatch { matchId: number; tournament: string; scheduledAt: Date; status: string; stage: string | null; streamUrl: string | null; opponents: string[] }
export interface MyMatches { matches: MyMatch[]; partial: boolean }   // partial: the lookup cap was hit before the window was covered
export function matchesForAsker(asker: Asker, window: { start: Date; end: Date }): Promise<MyMatches | "id_unreliable">;
// Changed before T27 (was matchesForDiscordUser). Bot token, ONE list_matches call over the window.
// Linked asker: match compact `players` names against the linked username/display name; no
// get_match calls. Unlinked: discord ids come from a shared per-match roster cache
// (get_match, cached 6 h per match), at most 20 uncached get_match calls per request (partial
// when hit). Keep matches where a player's user.discord_id is a STRING equal to the asker's id;
// a numeric discord_id anywhere -> "id_unreliable" (precision bug, still seen 2026-10-15 evening),
// and the answer asks the user to /link.

// challonge/challonge.ts
export interface BracketSummary {
  tournament: string; bracketUrl: string; rulesUrl: string | null;
  state: string | null;                                   // Challonge tournament state
  alive: string[]; eliminated: string[];                  // participant display names
  recent: { round: string; players: [string, string]; winner: string | null }[];
  upcoming: { round: string; players: [string | null, string | null] }[];   // open or pending pairings; null = slot not decided yet
  source: "challonge" | "link_only";                      // link_only when no key and no snapshot
  fetchedAt: string | null;                               // ISO time the snapshot was taken
}
export function bracketFor(tournamentId: number): Promise<BracketSummary>;
// get_tournament (bot token) -> bracket_url -> Challonge API v2.1 (CHALLONGE_API_KEY, read-only).
// Snapshot per tournament, refreshed only when someone asks AND it is over 60 minutes old AND
// the community clock is between 08:00 and midnight (no refreshes 00:00 to 08:00 Eastern).
// Conditional request with the stored ETag; no Wizzrobe call decides freshness.
// A failed refresh serves the stale snapshot; no key and no snapshot -> "link_only", never an
// invented table. Monthly Challonge request guard at 450.

// responders/clientTools.ts
export function clientToolDefs(names: ClientTool[]): BetaTool[];   // strict input schemas
export function runClientTool(name: ClientTool, input: unknown, ctx: AskContext): Promise<string>;   // JSON string for tool_result

// personality/voice.ts
export type Register = "data" | "help" | "chat";
export function voice(register: Register): string;     // stable, cached, prepended to every responder system prompt

// responders/specs.ts
export interface ResponderSpec { route: Route; register: Register; instructions: string }
export const SPECS: Record<Route, ResponderSpec>;
export const SHARED_RULES: string;

// responders/base.ts
export function runResponder(route: Route, decision: RoutingDecision, ctx: AskContext): Promise<Answer>;

// actions/pending.ts
export function createPending(a: ProposedAction, discordUserId: string, now: Date): Promise<PendingAction>;
export function takePending(id: string, discordUserId: string, now: Date): Promise<PendingAction | "expired" | "not_yours">;
export function saveThread(t: Omit<ThreadRecord, "createdAt" | "expiresAt">, now: Date): Promise<ThreadRecord>;
export function loadThread(id: string, discordUserId: string, now: Date): Promise<ThreadRecord | "expired" | "not_yours">;
// Threads are not single use: loading one slides its TTL (1800 s) and keeps it.

// actions/execute.ts
export const WRITE_ARGS: Record<WriteTool, z.ZodType>;              // strict arg schema per write tool (no tenant)
export function executeAction(p: PendingAction): Promise<string>;   // user-facing result line
// Arg shapes, from the live MCP schemas (2026-10-15): match tools {match_id}; crew tools
// {match_id, role: "commentator" | "tracker"}; tournament entry {tournament_id};
// submit_match_request {tournament_id, scheduled_date, scheduled_time, player_ids, comment?};
// rest_create_reschedule_request {match_id, kind, reason, proposed_at?};
// rest_book_bracket_game {bracket_match_id, scheduled_date, scheduled_time, comment?}.

// handlers/ask.ts (revised for the hybrid model, 2026-10-15)
export interface PipelineRequest {
  requestId: string;
  asker: Asker;                         // built by the caller: loadAsker (interaction) or loadAskerFromMessage (relay)
  question: string;                     // already normalized by the caller
  reply: ReplyTarget;                   // where the answer goes
  history: ConversationTurn[];          // earlier turns: from the thread (slash path) or the reply chain (message path)
  threadId?: string;                    // the thread this continues, if any (follow-up, picked choice)
  forced?: RoutingDecision;             // slash shortcuts, /me and picked choices skip the router
  now: Date;
}
export function runAskPipeline(req: PipelineRequest): Promise<void>;   // never throws; always ends in a delivered reply (L16)
// Order: per-user lock -> kill switch -> budget -> route (unless forced) -> auth gate -> capability:
// route "account" -> runAccountAction; route "live" -> liveAnswer; else runResponder. Then
// save the thread (turns + this question + the answer text), then deliver.

// handlers/deliver.ts
export function deliver(target: ReplyTarget, answer: Answer, ids: { pendingId?: string; threadId?: string }): Promise<void>;
// interaction: edit the deferred reply with payload 0, followups for the rest; a private answer
// behind a public deferral -> public "I sent you the answer privately." + ephemeral followups.
// message: never ephemeral; a private answer is held on the thread and the reply is
// renderPrivateStub(threadId); public answers reply under the user's message (postMessage).
export function deliverError(target: ReplyTarget, message: string): Promise<void>;   // never throws

// handlers/account.ts (replaces handlers/link.ts)
export function accountAnswer(action: "link" | "unlink", asker: Asker, now: Date): Promise<Answer>;
// Always ephemeral. link: the one-time Wizzrobe link as a markdown link in the text (deliver keeps
// it private on every path); unlink: revoke + deleteLink. /link, /unlink and "connect me" all reach
// it through runAskPipeline with route "account".

// handlers/message.ts
export function runMessagePipeline(m: RelayMessage, requestId: string, now: Date): Promise<void>;   // never throws
// loadAskerFromMessage, history from m.chain (bot turns -> assistant, others -> user "Name: text"), reply target "message".

// handlers/shortcuts.ts
export function shortcutRequest(i: APIChatInputApplicationCommandInteraction, now: Date): { question: string; decision: RoutingDecision } | null;
// /schedule /live /standings /player -> a fixed route; null for any other command; UserInputError on a bad day

// handlers/component.ts
export function runComponent(i: APIMessageComponentInteraction, requestId: string, now: Date): Promise<void>;   // never throws
// confirm, cancel, choose (forks a public thread for a non-owner), private (shows the held answer)

// handlers/dispatch.ts
export function handleInteraction(i: APIInteraction, waitUntil: (p: Promise<unknown>) => void): Promise<Response>;
// followup and change buttons answer synchronously with a modal (type 9); modal submits (type 5)
// defer and run the pipeline on the thread.

// responders/direct.ts (no model call)
export function liveAnswer(now: Date): Promise<Answer>;                                        // what's on each stage now and next
export function scheduleAnswer(params: { day?: string; stage?: string; tournament?: string }, now: Date): Promise<Answer>;   // plain /schedule

// ops/alerts.ts
export function alertStaff(event: string, detail: string): Promise<void>;   // posts to STAFF_ALERT_CHANNEL_ID, at most once per event per 10 min; never throws
export function isPaused(): Promise<boolean>;                              // the Redis kill switch at keys.kill()

// api/interactions.ts, api/health.ts, api/oauth/callback.ts, api/message.ts (Vercel web-standard handlers)
export function POST(request: Request): Promise<Response>;   // interactions; message (relay, HMAC-signed, 202 then waitUntil)
export function GET(request: Request): Promise<Response>;    // health, oauth/callback
```

## Relay (`relay/`, its own package, deployed on Railway)

A gateway process with discord.js. Its only config module is `relay/src/config.ts` (RELAY_SECRET,
DISCORD_BOT_TOKEN, WIZZBREW_URL, RELAY_CHANNEL_IDS). It forwards a message when it @mentions the
bot, is a DM to the bot, or replies to one of the bot's messages, in an allowlisted channel (DMs
always), and ignores bots. It fetches up to 10 messages of the reply chain, expands mentions to
names, builds a `RelayMessage`, and POSTs it to `<WIZZBREW_URL>/api/message` with headers
`X-Relay-Timestamp` (unix seconds) and `X-Relay-Signature` (hex HMAC-SHA256 of
`timestamp + "." + body` with RELAY_SECRET). It sends a typing indicator and holds no other logic.

## Fakes (`tests/fakes/`, test code only)

```ts
// kv.ts
export class FakeKv implements Kv {
  constructor(clock?: () => number);                 // epoch ms; TTLs expire against it
  has(key: string): boolean;                         // present and not expired
  keys(): string[];                                  // live keys
}

// anthropic.ts
export class FakeAnthropic implements AnthropicLike {
  readonly requests: unknown[];                      // every create() params, in order
  queue(...msgs: BetaMessage[]): this;               // answered in order; create() on an empty queue throws
}
export function fakeMessage(content: BetaContentBlock[], opts?: { stop_reason?: string; model?: string; usage?: Partial<BetaUsage> }): BetaMessage;
export const block: {
  text(text: string): BetaContentBlock;
  thinking(thinking: string): BetaContentBlock;
  toolUse(name: string, input: unknown, id?: string): BetaContentBlock;
  mcpToolUse(name: string, input: unknown, id?: string): BetaContentBlock;          // server_name "wizzrobe"
  mcpToolResult(toolUseId: string, text: string, isError?: boolean): BetaContentBlock;
};

// discord.ts
export class FakeDiscordApi implements DiscordApi {
  readonly calls: { method: "editOriginal" | "followup" | "registerCommands" | "postMessage"; token: string | null; body: unknown }[];
  failNext(err: Error): void;                        // the next call throws err
}

// wizzrobe.ts
export class FakeWizzrobe {
  readonly calls: { tool: string; token: string; args: Record<string, unknown> }[];
  readonly rawToolCall: RawToolCall;                 // answers from tests/fixtures/wizzrobe/<tool>.json
  readonly fetch: typeof fetch;                      // REST gaps, from rest_*.json fixtures
  featuresOff: boolean;                              // bracket, qualifier, race-room tools -> not_found (default true)
  answer(tool: string, result: unknown): void;       // override one tool's result
  failTool(tool: string, code: string, message: string): void;   // isError text "<code>: <message>"
  failRest(path: string, status: number, detail: string, retryAfterSec?: number): void;
}

// challonge.ts
export class FakeChallonge {
  readonly requests: string[];                       // URLs fetched
  readonly fetch: typeof fetch;                      // serves tests/fixtures/challonge/*.json
  fail(status: number): void;                        // every later request answers this status
}

// fetch.ts
export function combineFetch(...routes: { prefix: string; fetch: typeof fetch }[]): typeof fetch;   // by URL prefix; unknown URL throws
```

Fixture files carry a `_note` key; the fakes strip it before answering.

## How a request flows

1. `api/interactions.ts` reads the raw body and verifies it, answering 401 on failure. It answers
   PING with PONG. Otherwise it calls `handleInteraction`.
2. Slash command: reply at once with `{type: 5, data: {flags: ephemeral ? 64 : 0}}`, then do the
   rest in `waitUntil`:
   - `loadAsker`
   - `assertUnderBudget`
   - `normalizeInput`
   - `routeQuestion`
   - auth gate in code (`ROUTES[route].auth`; `NotLinkedError` -> "run /link first")
   - `runResponder`
   - `renderAnswer`
   - `discordApi().editOriginal`

   Every error goes through `userMessageFor`.
3. Responders run a tool loop with the MCP connector, scoped to `readTools`, plus the route's
   `clientTools`, which the loop executes in code through `runClientTool`.
   - Write routes also get one client tool, `propose_action`. When the model calls it, the loop
     ends with a `ProposedAction`. The write itself never runs inside the loop.
   - The handler stores it with `createPending` and renders Confirm/Cancel.
4. Button press: reply `{type: 6}` (deferred update), then in `waitUntil`:
   - `decodeCustomId`
   - `takePending`, which checks the user and expiry
   - `executeAction`: `callTool` or REST with `userAccessToken`
   - edit the message with the result

   No LLM call at confirm time.
5. The read connector gets the bot token on public routes and the user's token on linked and
   staff routes. Writes always use the user's token (`callTool` / REST).

## Review fixes (2026-10-15, after the three reviewers)

```ts
// config.ts additions
discordClientSecret: string;          // DISCORD_CLIENT_SECRET (Discord app OAuth2), required
discordOauthRedirectUri: string;      // DISCORD_OAUTH_REDIRECT_URI, https://<domain>/api/oauth/discord

// wizzrobe/oauth.ts: linking proves the browser is the Discord user the link was made for
export function startLink(discordUserId: string): Promise<{ url: string }>;   // now a Discord authorize URL (scope identify)
export function verifyDiscord(code: string, state: string): Promise<{ redirectTo: string }>;   // Discord user must equal the state's; then the Wizzrobe authorize URL
export function finishLink(code: string, state: string): Promise<{ discordUserId: string }>;   // only for a verified state; refuses a Wizzrobe user linked to another Discord id
// api/oauth/discord.ts GET: the Discord redirect target (calls verifyDiscord, 302 to Wizzrobe)
// State records are taken atomically (kv.take). identity.ts keeps a reverse key per Wizzrobe user id.

// errors.ts
export function userMessageFor(err: unknown, opts?: { public?: boolean }): string;
// public: never include Wizzrobe or Discord detail text. Anthropic SDK 429/529/5xx -> "The model is busy right now. Try again in a minute."

// ops/rate.ts
export function allowRequest(discordUserId: string, now: Date): Promise<boolean>;   // 8 per minute and 60 per hour per user

// actions/execute.ts
export function describeAction(tool: WriteTool, args: Record<string, unknown>): string;   // the Confirm line, from validated args only

// challonge/challonge.ts
// BracketSummary gains `degraded: boolean`: true when a refresh just failed (the answer says the lookup failed for now)

// llm/budget.ts
export function recordSpend(model: string, usage: BetaUsage, now: Date, fallbackModel?: string): Promise<number>;   // unknown model -> price as fallbackModel and warn
```
- Lock TTL 300 s. Thread turns never carry the OAuth URL (a placeholder turn instead).
- Signed interactions older than 300 s are rejected. Confirm presses honor the kill switch.
- Bot-token Wizzrobe calls are capped at 100 a minute per token in mcp.ts (over -> WizzrobeError 429).
- Relay DMs are forwarded only from members of a guild that owns an allowlisted channel.

Helper exports beyond the contract, accepted at merge: oauth.ts `pkcePair`, `discoverMetadata`,
`exchangeCode`; challonge.ts `parseBracketUrl`; tests/fakes/fetch.ts `requestUrl`. `renderError`
accepts `ephemeral` for symmetry and ignores it (visibility is set at deferral). `RelayMessage.isDm`
is validated but only the relay uses it.
