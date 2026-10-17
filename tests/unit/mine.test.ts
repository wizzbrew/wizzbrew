import { beforeEach, describe, expect, it, vi } from "vitest";
import { setKvForTests } from "../../src/store/kv.js";
import type { Asker } from "../../src/types.js";
import { callTool } from "../../src/wizzrobe/mcp.js";
import { matchesForAsker } from "../../src/wizzrobe/mine.js";
import { FakeKv } from "../fakes/kv.js";

vi.mock("../../src/wizzrobe/mcp.js", () => ({ callTool: vi.fn() }));
vi.mock("../../src/wizzrobe/tokens.js", () => ({ botAccessToken: vi.fn(async () => "bot") }));

const callToolMock = vi.mocked(callTool);
const WINDOW = { start: new Date("2026-10-15T12:00:00Z"), end: new Date("2026-10-22T12:00:00Z") };
const ME = "100000000000000001";

function asker(linked: boolean): Asker {
  return {
    discordUserId: ME,
    discordName: "me",
    guildId: null,
    channelId: "1",
    linked: linked
      ? { wizzrobeUserId: 5, wizzrobeUsername: "Player One", roles: [], canWrite: false }
      : null,
  };
}

interface Item {
  id: number;
  status?: string;
  players?: string[];
}

function listed(items: Item[]) {
  return items.map((i) => ({
    id: i.id,
    tournament: "ALttPR",
    scheduled_at: `2026-10-16T${String(10 + (i.id % 12)).padStart(2, "0")}:00:00Z`,
    status: i.status ?? "scheduled",
    players: i.players ?? ["Player One", "Player Two"],
    stage: "Fire",
    restream_url: "https://twitch.tv/x",
  }));
}

function roster(discordIds: (string | number)[]) {
  return {
    players: discordIds.map((d, i) => ({ user: { display_name: `P${i}`, discord_id: d } })),
  };
}

function setup(list: unknown, rosters: (id: number) => unknown) {
  callToolMock.mockImplementation(async (_t, name, args) => {
    if (name === "list_matches") return list;
    return rosters(args.match_id as number);
  });
}

const getMatchCalls = () => callToolMock.mock.calls.filter((c) => c[1] === "get_match").length;

beforeEach(() => {
  callToolMock.mockReset();
  setKvForTests(new FakeKv());
});

describe("matchesForAsker", () => {
  it("linked: one list call, matched by username, no get_match", async () => {
    setup(
      listed([
        { id: 1, players: ["player one", "Player Two"] },
        { id: 2, players: ["Player Three", "Player Four"] },
      ]),
      () => {
        throw new Error("no");
      },
    );
    const res = await matchesForAsker(asker(true), WINDOW);
    if (res === "id_unreliable") throw new Error("unexpected");
    expect(res.partial).toBe(false);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0]?.opponents).toEqual(["Player Two"]);
    expect(res.matches[0]?.stage).toBe("Fire");
    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(getMatchCalls()).toBe(0);
  });

  it("unlinked: finds the match by discord id and caches rosters", async () => {
    setup(listed([{ id: 1 }, { id: 2 }]), (id) => roster(id === 2 ? [ME, "2"] : ["3", "4"]));
    const res = await matchesForAsker(asker(false), WINDOW);
    if (res === "id_unreliable") throw new Error("unexpected");
    expect(res.matches.map((m) => m.matchId)).toEqual([2]);
    expect(res.matches[0]?.opponents).toEqual(["P1"]);
    expect(getMatchCalls()).toBe(2);
    await matchesForAsker(asker(false), WINDOW);
    expect(getMatchCalls()).toBe(2);
  });

  it("numeric discord id is unreliable", async () => {
    setup(listed([{ id: 1 }]), () => roster([1e17, "2"]));
    expect(await matchesForAsker(asker(false), WINDOW)).toBe("id_unreliable");
  });

  it("caps uncached get_match calls at 20 and reports partial", async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    setup(listed(items), () => roster(["3", "4"]));
    const res = await matchesForAsker(asker(false), WINDOW);
    if (res === "id_unreliable") throw new Error("unexpected");
    expect(getMatchCalls()).toBe(20);
    expect(res.partial).toBe(true);
  });

  it("drops complete and cancelled matches", async () => {
    setup(
      listed([
        { id: 1, status: "complete" },
        { id: 2, status: "cancelled" },
        { id: 3, status: "scheduled" },
      ]),
      () => {
        throw new Error("no");
      },
    );
    const res = await matchesForAsker(asker(true), WINDOW);
    if (res === "id_unreliable") throw new Error("unexpected");
    expect(res.matches.map((m) => m.matchId)).toEqual([3]);
  });
});
