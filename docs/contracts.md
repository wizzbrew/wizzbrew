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
  wizzrobe/mine.ts       matchesForDiscordUser: a user's matches by Discord id, no link needed
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
  handlers/link.ts       /link /unlink /me
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
  | "my_stuff" | "crew" | "player_actions" | "help" | "staff" | "chat";

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

export interface ThreadRecord {       // disambiguation context, keys.thread(id), sliding TTL (L15)
  id: string;
  discordUserId: string;              // only this user may pick a choice
  question: string;                   // the normalized question that produced the choices
  decision: RoutingDecision;
  ephemeral: boolean;
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
| `NotLinkedError` | its message if non-empty, else "Run /link first to connect your Wizzrobe account." |
| `BudgetExceededError` | "I've hit today's usage limit. Try again tomorrow." |
| `WizzrobeError` 429 | "Wizzrobe is busy, try again in a minute." |
| `WizzrobeError` 401 | "Your Wizzrobe link expired. Run /link to connect again." |
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
// pendingId -> Confirm/Cancel buttons; threadId -> one "choose" button per choice
export function renderError(message: string, ephemeral: boolean): RESTPatchAPIInteractionOriginalResponseJSONBody;
// every payload carries allowed_mentions: { parse: [] } (L20)

// discord/commands.ts (added before wave 1)
export type CommandName = "ask" | "schedule" | "live" | "standings" | "player" | "link" | "unlink" | "me";
export const COMMANDS: RESTPostAPIChatInputApplicationCommandsJSONBody[];   // what register-commands PUTs

// discord/components.ts
export type ComponentAction =
  | { kind: "confirm"; pendingId: string }
  | { kind: "cancel"; pendingId: string }
  | { kind: "choose"; threadId: string; value: string };
export function encodeCustomId(a: ComponentAction): string;   // <= 100 chars
export function decodeCustomId(id: string): ComponentAction | null;

// discord/api.ts
export interface DiscordApi {
  editOriginal(token: string, body: unknown): Promise<void>;
  followup(token: string, body: unknown): Promise<void>;
  registerCommands(commands: unknown[], guildId?: string): Promise<void>;
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
};

// store/crypto.ts
export function seal(plaintext: string): Promise<string>;     // AES-256-GCM, TOKEN_ENCRYPTION_KEY
export function open(sealed: string): Promise<string>;

// llm/models.ts
export const MODELS: { router: "claude-haiku-5-5"; responder: "claude-sonnet-5-5"; chat: "claude-haiku-5-5" };
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
  beta: { messages: { create(params: BetaMessageCreateParams & { betas?: string[] }): Promise<BetaMessage> } };
}
export function createMessage(purpose: Purpose, params: Omit<BetaMessageCreateParams, "model"> & { betas?: string[] }, ctx: { requestId: string; now: Date }): Promise<BetaMessage>;
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
export function matchesForDiscordUser(discordUserId: string, window: { start: Date; end: Date }): Promise<MyMatch[] | "id_unreliable">;
// Bot token. list_matches over the window, get_match per match (cached), keep matches where a
// player's user.discord_id is a STRING equal to discordUserId. A numeric discord_id anywhere in
// the batch -> "id_unreliable" (the precision bug, L19); the answer then asks the user to /link.

// challonge/challonge.ts
export interface BracketSummary {
  tournament: string; bracketUrl: string; rulesUrl: string | null;
  state: string | null;                                   // Challonge tournament state
  alive: string[]; eliminated: string[];                  // participant display names
  recent: { round: string; players: [string, string]; winner: string | null }[];
  source: "challonge" | "link_only";                      // link_only when no key or the fetch failed
}
export function bracketFor(tournamentId: number): Promise<BracketSummary>;
// get_tournament (bot token) -> bracket_url -> Challonge API (CHALLONGE_API_KEY, read-only),
// cached 120 s. No key or a Challonge failure -> source "link_only", never an invented table.

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
// Threads are not single use: loading one slides its TTL (600 s) and keeps it.

// actions/execute.ts
export function executeAction(p: PendingAction): Promise<string>;   // user-facing result line

// handlers/ask.ts
export interface PipelineRequest {
  requestId: string;
  interaction: APIInteraction;          // for loadAsker and the interaction token
  question: string;                     // raw text; the pipeline runs normalizeInput itself
  ephemeral: boolean;
  forced?: RoutingDecision;             // shortcuts, /me and picked choices skip the router
  now: Date;
}
export function runAskPipeline(req: PipelineRequest): Promise<void>;   // never throws; always ends in editOriginal (L16)

// handlers/shortcuts.ts
export function shortcutRequest(i: APIChatInputApplicationCommandInteraction, now: Date): { question: string; decision: RoutingDecision } | null;
// /schedule /live /standings /player -> a fixed route; null for any other command; UserInputError on a bad day

// handlers/link.ts
export function runLinkCommand(name: "link" | "unlink" | "me", i: APIChatInputApplicationCommandInteraction, requestId: string, now: Date): Promise<void>;   // never throws

// handlers/component.ts
export function runComponent(i: APIMessageComponentInteraction, requestId: string, now: Date): Promise<void>;   // never throws

// handlers/dispatch.ts
export function handleInteraction(i: APIInteraction, waitUntil: (p: Promise<unknown>) => void): Promise<Response>;

// api/interactions.ts, api/health.ts, api/oauth/callback.ts (Vercel web-standard handlers)
export function POST(request: Request): Promise<Response>;   // interactions
export function GET(request: Request): Promise<Response>;    // health, oauth/callback
```

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
  readonly calls: { method: "editOriginal" | "followup" | "registerCommands"; token: string | null; body: unknown }[];
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
