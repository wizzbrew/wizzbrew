import type { APIInteraction } from "discord-api-types/v10";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotLinkedError, WizzrobeError } from "../../src/errors.js";
import { seal } from "../../src/store/crypto.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import type { LinkRecord } from "../../src/types.js";
import { deleteLink, getLink, loadAsker, saveLink } from "../../src/wizzrobe/identity.js";
import { callTool } from "../../src/wizzrobe/mcp.js";
import { refresh } from "../../src/wizzrobe/oauth.js";
import { FakeKv } from "../fakes/kv.js";

vi.mock("../../src/wizzrobe/oauth.js", () => ({ refresh: vi.fn() }));
vi.mock("../../src/wizzrobe/mcp.js", () => ({ callTool: vi.fn() }));

const refreshMock = vi.mocked(refresh);
const callToolMock = vi.mocked(callTool);
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const USER = "111111111111111111";

let fakeKv: FakeKv;

async function makeLink(overrides: Partial<LinkRecord> = {}): Promise<LinkRecord> {
  return {
    sealedRefreshToken: await seal("user-r0"),
    wizzrobeUserId: 206,
    username: "homemadebeer",
    roles: ["crew"],
    canWrite: false,
    linkedAt: NOW - 86_400_000,
    rolesCheckedAt: NOW - 1_000,
    ...overrides,
  };
}

function guildInteraction(): APIInteraction {
  return {
    id: "900000000000000001",
    guild_id: "222222222222222222",
    channel: { id: "333333333333333333", type: 0 },
    channel_id: "333333333333333333",
    member: {
      nick: "Guild Nick",
      user: {
        id: USER,
        username: "homemadebeer",
        global_name: "Global Name",
        discriminator: "0",
        avatar: null,
      },
    },
  } as unknown as APIInteraction;
}

function dmInteraction(): APIInteraction {
  return {
    id: "900000000000000002",
    channel_id: "444444444444444444",
    user: {
      id: USER,
      username: "homemadebeer",
      global_name: "Global Name",
      discriminator: "0",
      avatar: null,
    },
  } as unknown as APIInteraction;
}

const WHOAMI = {
  user_id: 206,
  username: "homemadebeer",
  display_name: null,
  is_super_admin: false,
  can_write: true,
  tenants: [
    { slug: "other", name: "Other", roles: ["admin"], features: [] },
    { slug: "sgl26", name: "SpeedGaming Live 2026", roles: ["restreamer", "crew"], features: [] },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fakeKv = new FakeKv();
  setKvForTests(fakeKv);
  refreshMock.mockReset();
  callToolMock.mockReset();
  refreshMock.mockResolvedValue({
    accessToken: "user-a1",
    refreshToken: "user-r0",
    expiresIn: 3600,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setKvForTests(null);
});

describe("loadAsker", () => {
  it("reads the guild member, and the nick wins over the global name", async () => {
    const asker = await loadAsker(guildInteraction());
    expect(asker).toEqual({
      discordUserId: USER,
      discordName: "Guild Nick",
      guildId: "222222222222222222",
      channelId: "333333333333333333",
      linked: null,
    });
  });

  it("falls back to the global name, then the username", async () => {
    const guild = guildInteraction() as unknown as { member: { nick: string | null } };
    guild.member.nick = null;
    expect((await loadAsker(guild as unknown as APIInteraction)).discordName).toBe("Global Name");

    const dm = dmInteraction() as unknown as { user: { global_name: string | null } };
    dm.user.global_name = null;
    expect((await loadAsker(dm as unknown as APIInteraction)).discordName).toBe("homemadebeer");
  });

  it("reads the user in a DM with no guild", async () => {
    const asker = await loadAsker(dmInteraction());
    expect(asker).toEqual({
      discordUserId: USER,
      discordName: "Global Name",
      guildId: null,
      channelId: "444444444444444444",
      linked: null,
    });
  });

  it("throws when the interaction has no user", async () => {
    const bare = { id: "900000000000000003" } as unknown as APIInteraction;
    await expect(loadAsker(bare)).rejects.toThrow("interaction has no user");
  });

  it("returns linked null without a link record", async () => {
    const asker = await loadAsker(guildInteraction());
    expect(asker.linked).toBeNull();
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it("does not call whoami when roles are fresh", async () => {
    await saveLink(USER, await makeLink());

    const asker = await loadAsker(guildInteraction());

    expect(asker.linked).toEqual({
      wizzrobeUserId: 206,
      wizzrobeUsername: "homemadebeer",
      roles: ["crew"],
      canWrite: false,
    });
    expect(callToolMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes stale roles through whoami and saves them", async () => {
    await saveLink(USER, await makeLink({ rolesCheckedAt: NOW - 600_001 }));
    callToolMock.mockResolvedValueOnce(WHOAMI);

    const asker = await loadAsker(guildInteraction());

    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(callToolMock).toHaveBeenCalledWith("user-a1", "whoami", {});
    expect(asker.linked).toEqual({
      wizzrobeUserId: 206,
      wizzrobeUsername: "homemadebeer",
      roles: ["restreamer", "crew"],
      canWrite: true,
    });
    const saved = await getLink(USER);
    expect(saved?.roles).toEqual(["restreamer", "crew"]);
    expect(saved?.canWrite).toBe(true);
    expect(saved?.rolesCheckedAt).toBe(NOW);

    // Fresh again, so a second load does not call whoami.
    await loadAsker(guildInteraction());
    expect(callToolMock).toHaveBeenCalledTimes(1);
  });

  it("returns linked null when whoami reports the link is gone", async () => {
    await saveLink(USER, await makeLink({ rolesCheckedAt: NOW - 700_000 }));
    callToolMock.mockRejectedValueOnce(new NotLinkedError("gone"));

    const asker = await loadAsker(guildInteraction());

    expect(asker.linked).toBeNull();
  });

  it("returns linked null when the token refresh shows the link expired", async () => {
    await saveLink(USER, await makeLink({ rolesCheckedAt: NOW - 700_000 }));
    refreshMock.mockRejectedValueOnce(new WizzrobeError(401, "invalid_grant"));

    const asker = await loadAsker(guildInteraction());

    expect(asker.linked).toBeNull();
    expect(callToolMock).not.toHaveBeenCalled();
    expect(await getLink(USER)).toBeNull();
  });

  it("keeps the stored roles and warns when whoami fails", async () => {
    const rec = await makeLink({ rolesCheckedAt: NOW - 700_000 });
    await saveLink(USER, rec);
    const warnLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    callToolMock.mockRejectedValueOnce(new WizzrobeError(500, "boom"));

    const asker = await loadAsker(guildInteraction());

    expect(asker.linked).toEqual({
      wizzrobeUserId: 206,
      wizzrobeUsername: "homemadebeer",
      roles: ["crew"],
      canWrite: false,
    });
    expect(await getLink(USER)).toEqual(rec);
    expect(warnLog).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warnLog.mock.calls[0]?.[0]))).toMatchObject({
      level: "warn",
      event: "identity.roles_refresh_failed",
    });
  });

  it("keeps the stored roles when whoami has no entry for the community", async () => {
    await saveLink(USER, await makeLink({ rolesCheckedAt: NOW - 700_000 }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    callToolMock.mockResolvedValueOnce({ ...WHOAMI, tenants: [WHOAMI.tenants[0]] });

    const asker = await loadAsker(guildInteraction());

    expect(asker.linked?.roles).toEqual(["crew"]);
  });
});

describe("link storage", () => {
  it("round-trips a record under keys.link without a TTL", async () => {
    const rec = await makeLink();
    await saveLink(USER, rec);

    expect(await getLink(USER)).toEqual(rec);
    expect(fakeKv.keys()).toEqual([keys.link(USER)]);
    vi.setSystemTime(NOW + 400 * 86_400_000);
    expect(await getLink(USER)).toEqual(rec);
  });

  it("returns null for an unknown user", async () => {
    expect(await getLink(USER)).toBeNull();
  });

  it("deleteLink removes the link and the cached access token", async () => {
    await saveLink(USER, await makeLink());
    await fakeKv.set(keys.userToken(USER), { accessToken: "x", expiresAt: NOW + 300_000 });

    await deleteLink(USER);

    expect(fakeKv.has(keys.link(USER))).toBe(false);
    expect(fakeKv.has(keys.userToken(USER))).toBe(false);
  });
});
