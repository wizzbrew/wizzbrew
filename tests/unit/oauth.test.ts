import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../../src/config.js";
import { UserInputError, WizzrobeError } from "../../src/errors.js";
import { open } from "../../src/store/crypto.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { getLinkOwner, saveLink } from "../../src/wizzrobe/identity.js";
import { callTool } from "../../src/wizzrobe/mcp.js";
import {
  discoverMetadata,
  exchangeCode,
  finishLink,
  pkcePair,
  refresh,
  revoke,
  startLink,
  verifyDiscord,
} from "../../src/wizzrobe/oauth.js";
import { FakeKv } from "../fakes/kv.js";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<{ randomBytes: typeof randomBytes }>();
  return { ...actual, randomBytes: vi.fn(actual.randomBytes) };
});
vi.mock("../../src/wizzrobe/mcp.js", () => ({ callTool: vi.fn() }));
vi.mock("../../src/wizzrobe/identity.js", () => ({ saveLink: vi.fn(), getLinkOwner: vi.fn() }));

const IDP = "https://idp.wizzrobe.test";
const METADATA = {
  issuer: `${IDP}/`,
  authorization_endpoint: `${IDP}/authorize`,
  token_endpoint: `${IDP}/token`,
  registration_endpoint: `${IDP}/register`,
  revocation_endpoint: `${IDP}/revoke`,
  scopes_supported: ["wizzrobe:read", "wizzrobe:write"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
};
const METADATA_PATH = "/.well-known/oauth-authorization-server";

// Values from tests/setup.ts.
const CLIENT_ID = "test-oauth-client-id";
const CLIENT_SECRET = "test-oauth-client-secret";
const REDIRECT_URI = "https://bot.test/api/oauth/callback";
const MCP_URL = "https://wizzrobe.test/mcp";
const DISCORD_REDIRECT = "https://bot.test/api/oauth/discord";
const DISCORD_SECRET = "test-discord-client-secret";
const DISCORD_ACCESS = "discord-access-token";
const DISCORD_CODE = "discord-code-xyz";

const DISCORD_ID = "123456789012345678";
const CODE = "auth-code-xyz";
const ACCESS = "access-token-abc";
const REFRESH = "refresh-token-abc";

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function whoami(slug = "sgl26"): unknown {
  return {
    user_id: 206,
    username: "zelda_fan",
    display_name: null,
    can_write: true,
    tenants: [{ slug, name: "SpeedGaming Live 2026", roles: ["crew", "restreamer"], features: [] }],
  };
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

let kvStore: FakeKv;
let clock = 1_000_000;
let metadataReply: () => Response;
let tokenReply: () => Response;
let revokeReply: () => Response;
let discordUser: string;
let fetchMock: ReturnType<typeof vi.fn<Handler>>;
let baseCounter = 0;

function callsTo(url: string): { url: string; init: RequestInit }[] {
  return fetchMock.mock.calls.filter(([u]) => u === url).map(([u, init]) => ({ url: u, init }));
}

function bodyOf(call: { init: RequestInit }): URLSearchParams {
  return new URLSearchParams(call.init.body as string);
}

function lastTokenBody(): URLSearchParams {
  const call = callsTo(`${IDP}/token`).at(-1);
  if (!call) throw new Error("no token request was made");
  return bodyOf(call);
}

beforeEach(() => {
  clock = 1_000_000;
  kvStore = new FakeKv(() => clock);
  setKvForTests(kvStore);
  // The metadata cache is per base URL, so each test gets its own and fetches it fresh.
  baseCounter += 1;
  vi.stubEnv("WIZZROBE_BASE_URL", `https://wizzrobe-${baseCounter}.test`);
  resetConfigForTests();

  metadataReply = () => json(200, METADATA);
  tokenReply = () =>
    json(200, {
      access_token: ACCESS,
      refresh_token: REFRESH,
      expires_in: 3600,
      token_type: "Bearer",
      scope: "wizzrobe:read wizzrobe:write",
    });
  revokeReply = () => new Response(null, { status: 200 });
  fetchMock = vi.fn<Handler>(async (url) => {
    if (url.endsWith(METADATA_PATH)) return metadataReply();
    if (url === `${IDP}/token`) return tokenReply();
    if (url === `${IDP}/revoke`) return revokeReply();
    if (url === "https://discord.com/api/v10/oauth2/token") {
      return json(200, { access_token: DISCORD_ACCESS, token_type: "Bearer" });
    }
    if (url === "https://discord.com/api/v10/users/@me") return json(200, { id: discordUser });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(callTool).mockReset().mockResolvedValue(whoami());
  vi.mocked(saveLink).mockReset().mockResolvedValue(undefined);
  vi.mocked(getLinkOwner).mockReset().mockResolvedValue(null);
  discordUser = DISCORD_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetConfigForTests();
  setKvForTests(null);
});

describe("pkcePair", () => {
  it("hashes the verifier as unpadded base64url SHA-256 (RFC 7636 appendix B)", () => {
    const rfcBytes = Buffer.from([
      116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77,
      105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
    ]);
    vi.mocked(randomBytes).mockImplementationOnce((() => rfcBytes) as never);
    expect(pkcePair()).toEqual({
      verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    });
  });

  it("makes a fresh 43 character verifier each time", () => {
    const a = pkcePair();
    const b = pkcePair();
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("discoverMetadata", () => {
  it("is fetched once and cached", async () => {
    await refresh(REFRESH);
    await revoke(REFRESH);
    const { url } = await startLink(DISCORD_ID);
    await verifyDiscord(DISCORD_CODE, new URL(url).searchParams.get("state") ?? "");
    const base = new URL(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(base.pathname).toBe(METADATA_PATH);
    expect(fetchMock.mock.calls.filter(([u]) => u.endsWith(METADATA_PATH))).toHaveLength(1);
  });

  it("uses the endpoints from the metadata, not the base URL host", async () => {
    await refresh(REFRESH);
    const hosts = fetchMock.mock.calls.map(([u]) => new URL(u).host);
    expect(hosts).toEqual([`wizzrobe-${baseCounter}.test`, "idp.wizzrobe.test"]);
  });

  it("does not cache a failure", async () => {
    metadataReply = () => json(503, {});
    await expect(discoverMetadata()).rejects.toMatchObject({ status: 503 });
    metadataReply = () => json(200, METADATA);
    await expect(discoverMetadata()).resolves.toMatchObject({ token_endpoint: `${IDP}/token` });
  });

  it("rejects metadata without the endpoints", async () => {
    metadataReply = () => json(200, { issuer: IDP });
    await expect(discoverMetadata()).rejects.toMatchObject({ status: 502 });
  });
});

describe("startLink", () => {
  it("returns the Discord authorize URL", async () => {
    const { url } = await startLink(DISCORD_ID);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://discord.com/oauth2/authorize");
    const p = parsed.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("client_id")).toBe("test-application-id");
    expect(p.get("scope")).toBe("identify");
    expect(p.get("redirect_uri")).toBe(DISCORD_REDIRECT);
    expect(p.get("prompt")).toBe("none");
    expect(p.get("state")).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(url).not.toContain(DISCORD_SECRET);
    expect(url).not.toContain(CLIENT_SECRET);
  });

  it("stores an unverified record under the state for 600 seconds", async () => {
    const { url } = await startLink(DISCORD_ID);
    const state = new URL(url).searchParams.get("state") ?? "";
    const stored = await kvStore.get<{ discordUserId: string; discordVerified: boolean }>(
      keys.oauthState(state),
    );
    expect(stored?.discordUserId).toBe(DISCORD_ID);
    expect(stored?.discordVerified).toBe(false);
    expect(url).not.toContain((stored as { verifier?: string }).verifier ?? "unreachable");

    clock += 599_000;
    expect(kvStore.has(keys.oauthState(state))).toBe(true);
    clock += 2_000;
    expect(kvStore.has(keys.oauthState(state))).toBe(false);
  });
});

describe("verifyDiscord", () => {
  async function begin(): Promise<string> {
    const { url } = await startLink(DISCORD_ID);
    return new URL(url).searchParams.get("state") ?? "";
  }

  it("marks the state verified and returns the Wizzrobe authorize URL", async () => {
    const state = await begin();
    const { redirectTo } = await verifyDiscord(DISCORD_CODE, state);
    const parsed = new URL(redirectTo);
    expect(parsed.origin + parsed.pathname).toBe(`${IDP}/authorize`);
    const p = parsed.searchParams;
    expect(p.get("client_id")).toBe(CLIENT_ID);
    expect(p.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(p.get("scope")).toBe("wizzrobe:read wizzrobe:write");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("resource")).toBe(MCP_URL);
    expect(p.get("state")).toBe(state);
    const stored = await kvStore.get<{ verifier: string; discordVerified: boolean }>(
      keys.oauthState(state),
    );
    expect(stored?.discordVerified).toBe(true);
    expect(p.get("code_challenge")).toBe(
      createHash("sha256")
        .update(stored?.verifier ?? "")
        .digest("base64url"),
    );
    const exchange = fetchMock.mock.calls.find(([u]) => u.endsWith("/oauth2/token"));
    expect(Object.fromEntries(new URLSearchParams(exchange?.[1].body as string))).toEqual({
      grant_type: "authorization_code",
      code: DISCORD_CODE,
      redirect_uri: DISCORD_REDIRECT,
      client_id: "test-application-id",
      client_secret: DISCORD_SECRET,
    });
  });

  it("keeps the remaining TTL", async () => {
    const realNow = vi.spyOn(Date, "now").mockImplementation(() => clock);
    const state = await begin();
    clock += 300_000;
    await verifyDiscord(DISCORD_CODE, state);
    clock += 299_000;
    expect(kvStore.has(keys.oauthState(state))).toBe(true);
    clock += 2_000;
    expect(kvStore.has(keys.oauthState(state))).toBe(false);
    realNow.mockRestore();
  });

  it("refuses a different Discord user, burns the state and saves nothing", async () => {
    const state = await begin();
    discordUser = "999999999999999999";
    const failure = await verifyDiscord(DISCORD_CODE, state).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(UserInputError);
    expect((failure as Error).message).toBe(
      "This link was made for a different Discord account. Ask me to link you from your own account.",
    );
    expect(kvStore.has(keys.oauthState(state))).toBe(false);
    await expect(finishLink(CODE, state)).rejects.toThrow(UserInputError);
    expect(saveLink).not.toHaveBeenCalled();
    expect(callsTo(`${IDP}/token`)).toHaveLength(0);
  });

  it("rejects an unknown state without calling Discord", async () => {
    await expect(verifyDiscord(DISCORD_CODE, "never-issued")).rejects.toThrow(
      "That link request expired. Ask me to link you again.",
    );
    expect(fetchMock.mock.calls.filter(([u]) => u.includes("discord.com"))).toHaveLength(0);
  });

  it("does not echo the code or tokens in a Discord failure", async () => {
    const state = await begin();
    fetchMock.mockImplementationOnce(async () => json(400, { error: DISCORD_CODE }));
    const failure = await verifyDiscord(DISCORD_CODE, state).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(UserInputError);
    expect((failure as Error).message).not.toContain(DISCORD_CODE);
    expect((failure as Error).message).not.toContain(DISCORD_ACCESS);
  });
});

describe("finishLink", () => {
  async function start(): Promise<{ state: string; verifier: string }> {
    const { url } = await startLink(DISCORD_ID);
    const state = new URL(url).searchParams.get("state") ?? "";
    await verifyDiscord(DISCORD_CODE, state);
    const stored = await kvStore.get<{ verifier: string }>(keys.oauthState(state));
    return { state, verifier: stored?.verifier ?? "" };
  }

  it("refuses a state whose Discord step was not finished", async () => {
    const { url } = await startLink(DISCORD_ID);
    const state = new URL(url).searchParams.get("state") ?? "";
    await expect(finishLink(CODE, state)).rejects.toThrow(/Finish the Discord step first/);
    expect(callsTo(`${IDP}/token`)).toHaveLength(0);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("lets only one of two concurrent callbacks win", async () => {
    const { state } = await start();
    const results = await Promise.allSettled([finishLink(CODE, state), finishLink(CODE, state)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(saveLink).toHaveBeenCalledTimes(1);
    expect(callsTo(`${IDP}/token`)).toHaveLength(1);
  });

  it("refuses a Wizzrobe account linked to another Discord account", async () => {
    const { state } = await start();
    vi.mocked(getLinkOwner).mockResolvedValue("555555555555555555");
    await expect(finishLink(CODE, state)).rejects.toThrow(
      "That Wizzrobe account is already linked to another Discord account. Unlink it there first.",
    );
    expect(getLinkOwner).toHaveBeenCalledWith(206);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("allows relinking by the same Discord account", async () => {
    const { state } = await start();
    vi.mocked(getLinkOwner).mockResolvedValue(DISCORD_ID);
    await expect(finishLink(CODE, state)).resolves.toEqual({ discordUserId: DISCORD_ID });
  });

  it("exchanges the code, asks whoami and saves the link", async () => {
    const { state, verifier } = await start();
    await expect(finishLink(CODE, state)).resolves.toEqual({ discordUserId: DISCORD_ID });

    const request = callsTo(`${IDP}/token`)[0];
    expect(request?.init.method).toBe("POST");
    expect(request?.init.headers).toMatchObject({
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(Object.fromEntries(lastTokenBody())).toEqual({
      grant_type: "authorization_code",
      code: CODE,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: verifier,
      resource: MCP_URL,
    });

    expect(callTool).toHaveBeenCalledWith(ACCESS, "whoami", {});
    expect(saveLink).toHaveBeenCalledTimes(1);
    const [id, record] = vi.mocked(saveLink).mock.calls[0] ?? [];
    expect(id).toBe(DISCORD_ID);
    expect(record).toMatchObject({
      wizzrobeUserId: 206,
      username: "zelda_fan",
      roles: ["crew", "restreamer"],
      canWrite: true,
    });
    expect(record?.sealedRefreshToken).not.toContain(REFRESH);
    await expect(open(record?.sealedRefreshToken ?? "")).resolves.toBe(REFRESH);
    expect(record?.linkedAt).toBe(record?.rolesCheckedAt);
    expect(Math.abs((record?.linkedAt ?? 0) - Date.now())).toBeLessThan(5_000);
  });

  it("is single use", async () => {
    const { state } = await start();
    await finishLink(CODE, state);
    await expect(finishLink(CODE, state)).rejects.toThrow(UserInputError);
    expect(callsTo(`${IDP}/token`)).toHaveLength(1);
  });

  it("burns the state even when the exchange fails", async () => {
    const { state } = await start();
    tokenReply = () => json(400, { error: "invalid_grant" });
    await expect(finishLink(CODE, state)).rejects.toThrow(WizzrobeError);
    expect(kvStore.has(keys.oauthState(state))).toBe(false);
  });

  it("rejects an unknown state", async () => {
    await expect(finishLink(CODE, "never-issued")).rejects.toThrow(
      "That link request expired. Ask me to link you again.",
    );
    expect(fetchMock.mock.calls.filter(([u]) => u === `${IDP}/token`)).toHaveLength(0);
  });

  it("rejects a state that cannot be a key", async () => {
    await expect(finishLink(CODE, "../../etc")).rejects.toThrow(UserInputError);
    await expect(finishLink(CODE, "")).rejects.toThrow(UserInputError);
  });

  it("rejects an expired state", async () => {
    const { state } = await start();
    clock += 601_000;
    await expect(finishLink(CODE, state)).rejects.toThrow(UserInputError);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("passes the token endpoint's description on as a WizzrobeError", async () => {
    const { state } = await start();
    tokenReply = () =>
      json(400, { error: "invalid_grant", error_description: "The code has expired" });
    const failure = await finishLink(CODE, state).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(WizzrobeError);
    expect(failure).toMatchObject({ status: 400, detail: "The code has expired" });
  });

  it("rejects an account that is not in the community", async () => {
    const { state } = await start();
    vi.mocked(callTool).mockResolvedValue(whoami("other-event"));
    await expect(finishLink(CODE, state)).rejects.toThrow(
      "Your Wizzrobe account isn't in this event's community yet. Join it on Wizzrobe, then run /link again.",
    );
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("rejects a whoami it cannot read", async () => {
    const { state } = await start();
    vi.mocked(callTool).mockResolvedValue({ user_id: "206" });
    await expect(finishLink(CODE, state)).rejects.toMatchObject({ status: 502 });
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("rejects a token response without a refresh token", async () => {
    const { state } = await start();
    tokenReply = () => json(200, { access_token: ACCESS, expires_in: 3600, token_type: "Bearer" });
    const failure = await finishLink(CODE, state).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(WizzrobeError);
    expect(failure).toMatchObject({ status: 502, detail: "Wizzrobe sent no refresh token" });
    expect(saveLink).not.toHaveBeenCalled();
  });
});

describe("exchangeCode", () => {
  it("returns the grant, leaving a missing refresh token undefined", async () => {
    tokenReply = () => json(200, { access_token: ACCESS, expires_in: 60, token_type: "Bearer" });
    await expect(exchangeCode(CODE, "v", "http://127.0.0.1:8976/callback")).resolves.toEqual({
      accessToken: ACCESS,
      refreshToken: undefined,
      expiresIn: 60,
    });
    expect(lastTokenBody().get("redirect_uri")).toBe("http://127.0.0.1:8976/callback");
  });

  it("rejects a token response it cannot read", async () => {
    tokenReply = () => json(200, { token_type: "Bearer" });
    await expect(exchangeCode(CODE, "v", REDIRECT_URI)).rejects.toMatchObject({ status: 502 });
  });
});

describe("refresh", () => {
  it("posts the refresh grant and returns the rotated token", async () => {
    tokenReply = () =>
      json(200, { access_token: "next-access", refresh_token: "next-refresh", expires_in: 900 });
    await expect(refresh(REFRESH)).resolves.toEqual({
      accessToken: "next-access",
      refreshToken: "next-refresh",
      expiresIn: 900,
    });
    expect(Object.fromEntries(lastTokenBody())).toEqual({
      grant_type: "refresh_token",
      refresh_token: REFRESH,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      resource: MCP_URL,
    });
  });

  it("keeps the old refresh token when none comes back", async () => {
    tokenReply = () => json(200, { access_token: "next-access", expires_in: 900 });
    await expect(refresh(REFRESH)).resolves.toEqual({
      accessToken: "next-access",
      refreshToken: REFRESH,
      expiresIn: 900,
    });
  });

  it("reports a rejected refresh token with its status and Retry-After", async () => {
    tokenReply = () => json(429, { error: "slow_down" }, { "retry-after": "30" });
    await expect(refresh(REFRESH)).rejects.toMatchObject({
      status: 429,
      detail: "slow_down",
      retryAfterSec: 30,
    });
    tokenReply = () => json(400, { error: "invalid_grant", error_description: "Token revoked" });
    await expect(refresh(REFRESH)).rejects.toMatchObject({ status: 400, detail: "Token revoked" });
  });

  it("falls back to a generic detail when the error body is not OAuth JSON", async () => {
    tokenReply = () => new Response("<html>bad gateway</html>", { status: 502 });
    const failure = await refresh(REFRESH).catch((e: unknown) => e);
    expect(failure).toMatchObject({ status: 502, detail: "oauth request failed" });
    expect((failure as WizzrobeError).retryAfterSec).toBeUndefined();
  });
});

describe("revoke", () => {
  it("posts the token to the revocation endpoint", async () => {
    await expect(revoke(REFRESH)).resolves.toBeUndefined();
    const call = callsTo(`${IDP}/revoke`)[0];
    expect(call?.init.method).toBe("POST");
    expect(Object.fromEntries(bodyOf(call ?? { init: {} }))).toEqual({
      token: REFRESH,
      token_type_hint: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
  });

  it("fails loudly on a non-2xx", async () => {
    revokeReply = () => json(503, { error: "temporarily_unavailable" });
    await expect(revoke(REFRESH)).rejects.toMatchObject({
      status: 503,
      detail: "temporarily_unavailable",
    });
  });
});

describe("secrets stay out of errors", () => {
  const secrets = [CODE, ACCESS, REFRESH, CLIENT_SECRET];

  function expectClean(err: unknown): void {
    expect(err).toBeInstanceOf(Error);
    const text = `${(err as Error).message} ${JSON.stringify(err)} ${String((err as Error).stack)}`;
    for (const secret of secrets) expect(text).not.toContain(secret);
  }

  it("holds for token errors, transport errors and bad responses", async () => {
    const failures: unknown[] = [];

    tokenReply = () => json(400, { error: "invalid_grant" });
    failures.push(await refresh(REFRESH).catch((e: unknown) => e));

    tokenReply = () => json(200, { access_token: 5 });
    failures.push(await refresh(REFRESH).catch((e: unknown) => e));

    tokenReply = () => {
      throw new Error(`connect failed for ${CLIENT_SECRET} ${REFRESH} ${CODE}`);
    };
    failures.push(await refresh(REFRESH).catch((e: unknown) => e));
    revokeReply = tokenReply;
    failures.push(await revoke(REFRESH).catch((e: unknown) => e));
    failures.push(await exchangeCode(CODE, "v", REDIRECT_URI).catch((e: unknown) => e));

    tokenReply = () => json(200, { access_token: ACCESS, expires_in: 1 });
    const { url } = await startLink(DISCORD_ID);
    const state = new URL(url).searchParams.get("state") ?? "";
    failures.push(await finishLink(CODE, state).catch((e: unknown) => e));
    failures.push(await finishLink(CODE, state).catch((e: unknown) => e));

    expect(failures).toHaveLength(7);
    for (const failure of failures) expectClean(failure);
    expect(failures[2]).toMatchObject({ status: 502, detail: "Wizzrobe could not be reached" });
  });
});
