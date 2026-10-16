import type {
  BetaContentBlock,
  BetaMessage,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { vi } from "vitest";

// Collects what the handlers hand to waitUntil, so tests can await the background work.
const held = vi.hoisted(() => ({ promises: [] as Promise<unknown>[] }));
vi.mock("@vercel/functions", () => ({
  waitUntil: (p: Promise<unknown>) => {
    held.promises.push(p);
  },
}));

import { POST } from "../../api/interactions.js";
import { resetConfigForTests } from "../../src/config.js";
import { setDiscordApiForTests } from "../../src/discord/api.js";
import { type AnthropicLike, setAnthropicForTests } from "../../src/llm/client.js";
import { MODELS } from "../../src/llm/models.js";
import { seal } from "../../src/store/crypto.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import type { LinkRecord } from "../../src/types.js";
import { setRawToolCallForTests } from "../../src/wizzrobe/mcp.js";
import { block, FakeAnthropic, fakeMessage } from "../fakes/anthropic.js";
import { FakeChallonge } from "../fakes/challonge.js";
import { FakeDiscordApi } from "../fakes/discord.js";
import { combineFetch, requestUrl } from "../fakes/fetch.js";
import { FakeKv } from "../fakes/kv.js";
import { FakeWizzrobe } from "../fakes/wizzrobe.js";

export const USER_A = "111111111111111111"; // linked in most scenarios
export const USER_B = "222222222222222222";
export const FAR_FUTURE = 4_102_444_800_000; // year 2100, epoch ms

const WIZZROBE_ORIGIN = "https://wizzrobe.test";

// An Anthropic fake whose next call can be held until the test lets it go.
export class GatedAnthropic implements AnthropicLike {
  readonly fake = new FakeAnthropic();
  private gate: Promise<void> | null = null;

  readonly beta: AnthropicLike["beta"] = {
    messages: {
      create: async (params, options) => {
        const gate = this.gate;
        this.gate = null;
        if (gate) await gate;
        return this.fake.beta.messages.create(params, options);
      },
    },
  };

  get requests(): unknown[] {
    return this.fake.requests;
  }

  queue(...msgs: BetaMessage[]): this {
    this.fake.queue(...msgs);
    return this;
  }

  // The next create() waits until the returned function is called.
  holdNext(): () => void {
    let release: () => void = () => undefined;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }
}

export interface World {
  kv: FakeKv;
  anthropic: GatedAnthropic;
  discord: FakeDiscordApi;
  wizzrobe: FakeWizzrobe;
  challonge: FakeChallonge;
  oauth: OauthStubs;
}

// What the stubbed Discord and Wizzrobe token endpoints answer during a link flow.
export interface OauthStubs {
  discordUserId: string; // the id Discord reports for whoever authorized
  discordCalls: string[]; // urls hit on discord.com, in order
  wizzrobeTokenCalls: number;
}

let signer: { privateKey: CryptoKey; publicKeyHex: string } | null = null;

async function ensureSigner(): Promise<{ privateKey: CryptoKey; publicKeyHex: string }> {
  if (signer) return signer;
  const generated: unknown = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ]);
  const pair = generated as { publicKey: CryptoKey; privateKey: CryptoKey };
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  signer = { privateKey: pair.privateKey, publicKeyHex: Buffer.from(raw).toString("hex") };
  return signer;
}

// Wires every boundary to a fake. Call it in beforeEach; call teardownWorld in afterEach.
export async function setupWorld(): Promise<World> {
  const keypair = await ensureSigner();
  vi.stubEnv("DISCORD_PUBLIC_KEY", keypair.publicKeyHex);
  resetConfigForTests();

  held.promises.length = 0;
  const kv = new FakeKv(() => Date.now());
  const anthropic = new GatedAnthropic();
  const discord = new FakeDiscordApi();
  const wizzrobe = new FakeWizzrobe();
  const challonge = new FakeChallonge();

  setKvForTests(kv);
  setAnthropicForTests(anthropic);
  setDiscordApiForTests(discord);
  setRawToolCallForTests(wizzrobe.rawToolCall);

  const metadata: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        authorization_endpoint: `${WIZZROBE_ORIGIN}/oauth/authorize`,
        token_endpoint: `${WIZZROBE_ORIGIN}/oauth/token`,
        revocation_endpoint: `${WIZZROBE_ORIGIN}/oauth/revoke`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const oauth: OauthStubs = { discordUserId: USER_A, discordCalls: [], wizzrobeTokenCalls: 0 };
  const jsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const discordOauth: typeof fetch = async (input) => {
    const url = requestUrl(input);
    oauth.discordCalls.push(url);
    if (url.endsWith("/oauth2/token")) return jsonResponse({ access_token: "discord-access" });
    if (url.endsWith("/users/@me")) return jsonResponse({ id: oauth.discordUserId });
    throw new Error(`no fake for ${url}`);
  };
  const wizzrobeToken: typeof fetch = async () => {
    oauth.wizzrobeTokenCalls += 1;
    return jsonResponse({
      access_token: "linked-access",
      refresh_token: "linked-refresh",
      expires_in: 3600,
    });
  };
  vi.stubGlobal(
    "fetch",
    combineFetch(
      { prefix: "https://discord.com/api/v10/", fetch: discordOauth },
      { prefix: `${WIZZROBE_ORIGIN}/oauth/token`, fetch: wizzrobeToken },
      { prefix: `${WIZZROBE_ORIGIN}/.well-known/`, fetch: metadata },
      { prefix: WIZZROBE_ORIGIN, fetch: wizzrobe.fetch },
      { prefix: "https://api.challonge.com", fetch: challonge.fetch },
    ),
  );

  // No OAuth fetch ever happens: the bot token is already cached.
  await kv.set(keys.botToken(), { accessToken: "bot-token", expiresAt: FAR_FUTURE });
  return { kv, anthropic, discord, wizzrobe, challonge, oauth };
}

export function teardownWorld(): void {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setKvForTests(null);
  setAnthropicForTests(null);
  setDiscordApiForTests(null);
  setRawToolCallForTests(null);
  held.promises.length = 0;
}

// A linked user: a LinkRecord sealed with the real crypto, plus a cached user token.
export async function linkUser(
  world: World,
  discordUserId: string,
  over: Partial<LinkRecord> = {},
): Promise<void> {
  const record: LinkRecord = {
    sealedRefreshToken: await seal("user-refresh-token"),
    wizzrobeUserId: 5,
    username: "player_one",
    roles: ["player"],
    canWrite: true,
    linkedAt: Date.now(),
    rolesCheckedAt: Date.now(),
    ...over,
  };
  await world.kv.set(keys.link(discordUserId), record);
  await world.kv.set(keys.userToken(discordUserId), {
    accessToken: "user-token",
    expiresAt: FAR_FUTURE,
  });
}

// Waits for all background work started so far.
export async function settle(): Promise<void> {
  let seen = 0;
  while (seen < held.promises.length) {
    const batch = held.promises.slice(seen);
    seen = held.promises.length;
    await Promise.all(batch);
  }
}

export interface Posted {
  status: number;
  body: Record<string, unknown>;
  done: Promise<void>; // the background work this one request started
}

// Signs the body with the test key.
export async function signedInteraction(body: unknown): Promise<Request> {
  const keypair = await ensureSigner();
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = await crypto.subtle.sign(
    "Ed25519",
    keypair.privateKey,
    new TextEncoder().encode(timestamp + raw),
  );
  return new Request("https://bot.test/api/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature-Ed25519": Buffer.from(sig).toString("hex"),
      "X-Signature-Timestamp": timestamp,
    },
    body: raw,
  });
}

// POSTs a signed interaction to api/interactions.ts.
export async function post(interaction: unknown): Promise<Posted> {
  const before = held.promises.length;
  const res = await POST(await signedInteraction(interaction));
  const mine = held.promises.slice(before);
  const text = await res.text();
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    done: Promise.all(mine).then(() => undefined),
  };
}

// Interaction builders

function userOf(id: string): { id: string; username: string; global_name: string } {
  return { id, username: `user${id.slice(-2)}`, global_name: `User ${id.slice(-2)}` };
}

const base = (id: string, token: string) => ({
  id: `int-${token}`,
  application_id: "test-application-id",
  token,
  version: 1,
  guild_id: "900000000000000001",
  channel_id: "900000000000000002",
  member: { user: userOf(id), nick: null },
});

export function slash(
  userId: string,
  token: string,
  name: string,
  options: { name: string; type: number; value: string }[] = [],
): Record<string, unknown> {
  return { ...base(userId, token), type: 2, data: { id: "cmd", type: 1, name, options } };
}

export function ask(userId: string, token: string, question: string): Record<string, unknown> {
  return slash(userId, token, "ask", [{ name: "question", type: 3, value: question }]);
}

export function press(userId: string, token: string, customId: string): Record<string, unknown> {
  return {
    ...base(userId, token),
    type: 3,
    data: { custom_id: customId, component_type: 2 },
    message: { id: "msg-1" },
  };
}

export function submitModal(
  userId: string,
  token: string,
  customId: string,
  value: string,
): Record<string, unknown> {
  return {
    ...base(userId, token),
    type: 5,
    data: {
      custom_id: customId,
      components: [{ type: 1, components: [{ type: 4, custom_id: "question", value }] }],
    },
  };
}

// Scripted model replies

const NO_PARAMS = {
  day: null,
  tournament: null,
  player: null,
  stage: null,
  matchId: null,
  accountAction: null,
};

export function routerReply(
  route: string,
  params: Record<string, unknown> = {},
  confidence = 0.9,
): BetaMessage {
  const json = { route, confidence, reason: "test", params: { ...NO_PARAMS, ...params } };
  return fakeMessage([block.text(JSON.stringify(json))], { model: MODELS.router });
}

export function responderReply(content: BetaContentBlock[]): BetaMessage {
  return fakeMessage(content, { model: MODELS.responder });
}

export function textReply(text: string): BetaMessage {
  return responderReply([block.text(text)]);
}

// Thinking first, then a connector call and its result, then the answer.
export function thinkingMcpReply(text: string): BetaMessage {
  return responderReply([
    block.thinking("Let me look at the schedule."),
    block.mcpToolUse("get_schedule", { date: "2026-10-16", tenant: "sgl26" }, "mcp_1"),
    block.mcpToolResult("mcp_1", '{"result":[]}'),
    block.text(text),
  ]);
}

export function clientToolReply(name: string, input: unknown): BetaMessage {
  return responderReply([block.toolUse(name, input)]);
}

export function proposeReply(
  tool: string,
  args: Record<string, unknown>,
  summary: string,
): BetaMessage {
  return responderReply([
    block.toolUse("propose_action", { tool, args_json: JSON.stringify(args), summary }),
  ]);
}

export function choicesReply(
  prompt: string,
  choices: { label: string; value: string }[],
): BetaMessage {
  return responderReply([block.toolUse("offer_choices", { prompt, choices })]);
}

// Reading what the fake Discord received

export interface Payload {
  content?: string;
  flags?: number;
  components?: { components: { label: string; custom_id: string }[] }[];
  allowed_mentions?: unknown;
}

export function sent(world: World, method: "editOriginal" | "followup", token?: string): Payload[] {
  return world.discord.calls
    .filter((c) => c.method === method && (token === undefined || c.token === token))
    .map((c) => c.body as Payload);
}

export function buttons(p: Payload): { label: string; custom_id: string }[] {
  return (p.components ?? []).flatMap((row) => row.components);
}

export function buttonId(p: Payload, label: string): string {
  const found = buttons(p).find((b) => b.label === label);
  if (!found) throw new Error(`no button labelled ${label}`);
  return found.custom_id;
}
