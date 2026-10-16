import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotLinkedError, WizzrobeError } from "../../src/errors.js";
import { open, seal } from "../../src/store/crypto.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import type { LinkRecord } from "../../src/types.js";
import { getLink } from "../../src/wizzrobe/identity.js";
import { refresh } from "../../src/wizzrobe/oauth.js";
import { botAccessToken, userAccessToken } from "../../src/wizzrobe/tokens.js";
import { FakeKv } from "../fakes/kv.js";

vi.mock("../../src/wizzrobe/oauth.js", () => ({ refresh: vi.fn() }));
vi.mock("../../src/wizzrobe/mcp.js", () => ({ callTool: vi.fn() }));

const refreshMock = vi.mocked(refresh);
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const USER = "111111111111111111";

let fakeKv: FakeKv;

async function makeLink(refreshToken: string): Promise<LinkRecord> {
  return {
    sealedRefreshToken: await seal(refreshToken),
    wizzrobeUserId: 206,
    username: "homemadebeer",
    roles: [],
    canWrite: true,
    linkedAt: NOW - 86_400_000,
    rolesCheckedAt: NOW,
  };
}

async function putLink(rec: LinkRecord): Promise<void> {
  await fakeKv.set(keys.link(USER), rec);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fakeKv = new FakeKv();
  setKvForTests(fakeKv);
  refreshMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setKvForTests(null);
});

describe("botAccessToken", () => {
  it("returns the cached token without refreshing", async () => {
    await fakeKv.set(keys.botToken(), { accessToken: "cached-bot", expiresAt: NOW + 300_000 });
    await expect(botAccessToken()).resolves.toBe("cached-bot");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("treats a token within a minute of expiry as expired", async () => {
    await fakeKv.set(keys.botToken(), { accessToken: "stale-bot", expiresAt: NOW + 30_000 });
    refreshMock.mockResolvedValueOnce({
      accessToken: "new-bot",
      refreshToken: "bot-r1",
      expiresIn: 3600,
    });
    await expect(botAccessToken()).resolves.toBe("new-bot");
  });

  it("refreshes with the env token first, then with the stored rotated one", async () => {
    refreshMock.mockResolvedValueOnce({
      accessToken: "bot-a1",
      refreshToken: "bot-r1",
      expiresIn: 3600,
    });
    await expect(botAccessToken()).resolves.toBe("bot-a1");
    expect(refreshMock).toHaveBeenLastCalledWith("test-bot-refresh-token");

    const stored = await fakeKv.get<{
      accessToken: string;
      expiresAt: number;
      sealedRefreshToken: string;
    }>(keys.botToken());
    expect(stored?.accessToken).toBe("bot-a1");
    expect(stored?.expiresAt).toBe(NOW + 3_600_000);
    expect(stored?.sealedRefreshToken).not.toContain("bot-r1");
    expect(await open(stored?.sealedRefreshToken ?? "")).toBe("bot-r1");

    // Cached again until the hour is nearly up.
    await expect(botAccessToken()).resolves.toBe("bot-a1");
    expect(refreshMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW + 3_600_000);
    refreshMock.mockResolvedValueOnce({
      accessToken: "bot-a2",
      refreshToken: "bot-r2",
      expiresIn: 3600,
    });
    await expect(botAccessToken()).resolves.toBe("bot-a2");
    expect(refreshMock).toHaveBeenLastCalledWith("bot-r1");

    const rotated = await fakeKv.get<{ sealedRefreshToken: string }>(keys.botToken());
    expect(await open(rotated?.sealedRefreshToken ?? "")).toBe("bot-r2");
  });

  it("logs the status only and rethrows when the refresh fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new WizzrobeError(503, "secret-detail-text");
    refreshMock.mockRejectedValueOnce(failure);

    await expect(botAccessToken()).rejects.toBe(failure);

    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ event: "tokens.bot_refresh_failed", status: 503 });
    expect(line).not.toContain("secret-detail-text");
    expect(line).not.toContain("test-bot-refresh-token");
  });
});

describe("userAccessToken", () => {
  it("returns the cached token without touching the link or refreshing", async () => {
    await fakeKv.set(keys.userToken(USER), {
      accessToken: "cached-user",
      expiresAt: NOW + 300_000,
    });
    await expect(userAccessToken(USER)).resolves.toBe("cached-user");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes on a miss, saves a rotated refresh token and caches with a TTL", async () => {
    await putLink(await makeLink("user-r0"));
    refreshMock.mockResolvedValueOnce({
      accessToken: "user-a1",
      refreshToken: "user-r1",
      expiresIn: 3600,
    });

    await expect(userAccessToken(USER)).resolves.toBe("user-a1");
    expect(refreshMock).toHaveBeenCalledWith("user-r0");

    const link = await getLink(USER);
    expect(await open(link?.sealedRefreshToken ?? "")).toBe("user-r1");
    expect(link?.wizzrobeUserId).toBe(206);
    expect(link?.username).toBe("homemadebeer");

    expect(await fakeKv.get(keys.userToken(USER))).toEqual({
      accessToken: "user-a1",
      expiresAt: NOW + 3_600_000,
    });
    await expect(userAccessToken(USER)).resolves.toBe("user-a1");
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // The cache entry lives for expiresIn minus 60 seconds.
    vi.setSystemTime(NOW + 3_539_000);
    expect(fakeKv.has(keys.userToken(USER))).toBe(true);
    vi.setSystemTime(NOW + 3_541_000);
    expect(fakeKv.has(keys.userToken(USER))).toBe(false);
  });

  it("leaves the link alone when the refresh token did not change", async () => {
    const rec = await makeLink("user-r0");
    await putLink(rec);
    refreshMock.mockResolvedValueOnce({
      accessToken: "user-a1",
      refreshToken: "user-r0",
      expiresIn: 3600,
    });

    await userAccessToken(USER);

    expect(await getLink(USER)).toEqual(rec);
  });

  it("keeps a TTL of at least one second for very short tokens", async () => {
    await putLink(await makeLink("user-r0"));
    refreshMock.mockResolvedValueOnce({
      accessToken: "user-a1",
      refreshToken: "user-r0",
      expiresIn: 30,
    });

    await userAccessToken(USER);

    expect(fakeKv.has(keys.userToken(USER))).toBe(true);
    vi.setSystemTime(NOW + 1_500);
    expect(fakeKv.has(keys.userToken(USER))).toBe(false);
  });

  it("throws NotLinkedError when there is no link", async () => {
    const err = await userAccessToken(USER).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotLinkedError);
    expect((err as Error).message).toBe(
      "Ask me to link your Wizzrobe account first (or use /link).",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it.each([400, 401])(
    "deletes the link and throws NotLinkedError on refresh %i",
    async (status) => {
      await putLink(await makeLink("user-r0"));
      await fakeKv.set(keys.userToken(USER), { accessToken: "old", expiresAt: NOW - 1 });
      refreshMock.mockRejectedValueOnce(new WizzrobeError(status, "invalid_grant"));

      const err = await userAccessToken(USER).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(NotLinkedError);
      expect((err as Error).message).toBe(
        "Your Wizzrobe link expired. Ask me to link you again (or use /link).",
      );
      expect(await getLink(USER)).toBeNull();
      expect(fakeKv.has(keys.userToken(USER))).toBe(false);
    },
  );

  it("propagates a 500 and keeps the link", async () => {
    const rec = await makeLink("user-r0");
    await putLink(rec);
    const failure = new WizzrobeError(500, "boom");
    refreshMock.mockRejectedValueOnce(failure);

    await expect(userAccessToken(USER)).rejects.toBe(failure);

    expect(await getLink(USER)).toEqual(rec);
  });
});
