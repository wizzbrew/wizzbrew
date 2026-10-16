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
```

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
```

`DiscordEmbed` and the raw interaction types come from `discord-api-types` (dev dependency, types
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
export function userMessageFor(err: unknown): string;   // the one place errors become replies (L16, L17)
```

## Module signatures

```ts
// config.ts
export interface Config { /* every var in .env.example, typed */ }
export function config(): Config;                        // throws on missing/invalid at first use

// time/time.ts
export function nowBlock(now: Date): string;             // "Current time: Thu 2026-10-15 20:14 America/New_York"
export function parseWizzrobeTime(iso: string): Date;
export function discordTimestamp(d: Date, style?: "f" | "F" | "t" | "R"): string;
export function communityDate(d: Date): string;          // YYYY-MM-DD in community tz
export function parseUserDateTime(text: string, now: Date): { date: string; time: string; instant: Date };
                                                         // community clock; throws UserInputError (L3)
export function dayWindowUtc(date: string): { start: Date; end: Date };   // community day -> UTC bounds

// discord/verify.ts
export function verifyDiscordRequest(rawBody: string, signature: string, timestamp: string, publicKey: string): Promise<boolean>;

// discord/markup.ts
export function normalizeInput(text: string, resolved?: APIInteractionDataResolved): string;   // L6
export function sanitizeForPrompt(text: string, maxLen?: number): string;                      // L8
export function finalizeText(text: string): string[];   // dash-free, split <= 2000 chars (L13)

// discord/render.ts
export function renderAnswer(a: Answer, pendingId?: string): RESTPatchAPIInteractionOriginalResponseJSONBody[];
export function renderError(message: string, ephemeral: boolean): RESTPatchAPIInteractionOriginalResponseJSONBody;
// every payload carries allowed_mentions: { parse: [] } (L20)

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

// store/kv.ts
export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrByFloat(key: string, by: number, ttlSec?: number): Promise<number>;
  expire(key: string, ttlSec: number): Promise<void>;
}
export function kv(): Kv;

// store/keys.ts
export const keys: {
  link(discordUserId: string): string;           // sealed LinkRecord
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
export function recordSpend(model: string, usage: Usage, now: Date): Promise<number>;

// llm/client.ts
export type Purpose = keyof typeof MODELS;
export function createMessage(purpose: Purpose, params: Omit<BetaMessageCreateParams, "model">, ctx: { requestId: string; now: Date }): Promise<BetaMessage>;
export function textOf(msg: BetaMessage): string;              // L9

// router/routes.ts
export interface RouteSpec { route: Route; auth: AuthLevel; readTools: string[]; writeTools: WriteTool[]; description: string }
export const ROUTES: Record<Route, RouteSpec>;

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
export function saveLink(discordUserId: string, rec: LinkRecord): Promise<void>;
export function deleteLink(discordUserId: string): Promise<void>;

// wizzrobe/mcp.ts
export function connectorParams(token: string, readTools: string[]): { mcp_servers: unknown[]; tools: unknown[]; betas: string[] };
export function callTool(token: string, name: string, args: Record<string, unknown>): Promise<unknown>;   // direct MCP tools/call, used for confirmed writes

// wizzrobe/rest.ts
export function createRescheduleRequest(token: string, matchId: number, body: { reason: string; preferredTime?: string }): Promise<unknown>;
export function bookBracketGame(token: string, bracketMatchId: number, body: { scheduledAt: string }): Promise<unknown>;
export function myOpenBracketMatches(token: string): Promise<unknown[]>;

// wizzrobe/resolve.ts
export function resolveByName<T>(input: string, items: T[], nameOf: (t: T) => string): ResolveResult<T>;   // L18

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

// actions/execute.ts
export function executeAction(p: PendingAction): Promise<string>;   // user-facing result line

// handlers/*
export function handleInteraction(i: APIInteraction, waitUntil: (p: Promise<unknown>) => void): Promise<Response>;
```

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
3. Responders run a tool loop with the MCP connector, scoped to `readTools`.
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
