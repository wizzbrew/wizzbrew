import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overrideChatToGame } from "../../src/game/override.js";
import { planGame } from "../../src/game/slices.js";
import type { RoutingDecision } from "../../src/types.js";

const chat = (over: Partial<RoutingDecision> = {}): RoutingDecision => ({
  route: "chat",
  confidence: 0.8,
  params: {},
  reason: "banter",
  ...over,
});

let out: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  out = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function logged(event: string): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  for (const call of out.mock.calls) {
    const line = JSON.parse(String(call[0])) as Record<string, unknown>;
    if (line.event === event) lines.push(line);
  }
  return lines;
}

describe("overrideChatToGame", () => {
  it("moves a chat question with a bare dungeon nickname to the game route", () => {
    const d = overrideChatToGame(chat(), "is mire hard?", "req-1");
    expect(d.route).toBe("game");
    expect(d.params).toEqual({ routine: "dungeon", subjects: ["Misery Mire"], game: "alttp" });
    expect(d.confidence).toBe(0.8);
    expect(d.reason).toContain("banter");
    expect(logged("router.override")).toEqual([
      expect.objectContaining({
        requestId: "req-1",
        from: "chat",
        to: "game",
        level: "info",
      }),
    ]);
  });

  it("moves a chat question that names a boss, as a dungeon routine", () => {
    const d = overrideChatToGame(chat(), "how do i beat kholdstare", "req-2");
    expect(d.route).toBe("game");
    expect(d.params).toEqual({ routine: "dungeon", subjects: ["Kholdstare"], game: "alttp" });
    expect(planGame(d).blocks).toHaveLength(1);
  });

  it("moves a chat question that names an item, as an items routine", () => {
    const d = overrideChatToGame(chat({ confidence: 0 }), "what does the Hookshot do", "req-3");
    expect(d.route).toBe("game");
    expect(d.params).toEqual({ routine: "items", subjects: ["Hookshot"], game: "alttp" });
    expect(d.confidence).toBe(0);
  });

  it("calls it a dungeon routine when an area and an item are both named", () => {
    const d = overrideChatToGame(chat(), "hookshot or boots for ice palace", "req-4");
    expect(d.params.routine).toBe("dungeon");
    expect(d.params.subjects).toEqual(["Hookshot", "Pegasus Boots", "Ice Palace"]);
  });

  it("keeps at most four subjects", () => {
    const d = overrideChatToGame(
      chat(),
      "mire, ice palace, skull woods, turtle rock, ganon's tower",
      "req-5",
    );
    expect(d.params.subjects).toHaveLength(4);
  });

  it("leaves a plain greeting as chat and logs nothing", () => {
    const d = chat();
    expect(overrideChatToGame(d, "hey, thanks for the help!", "req-6")).toBe(d);
    expect(logged("router.override")).toEqual([]);
  });

  it("leaves a chat question with only a two letter code as chat", () => {
    const d = chat();
    expect(overrideChatToGame(d, "tt and mm tonight?", "req-7")).toBe(d);
  });

  it("moves a Super Metroid boss, area or item to the game route with game sm", () => {
    const boss = overrideChatToGame(chat(), "how do i beat kraid", "req-8");
    expect(boss.params).toEqual({ routine: "dungeon", subjects: ["Kraid"], game: "sm" });
    expect(planGame(boss)).toMatchObject({ game: "sm", hasReference: true });
    const item = overrideChatToGame(chat(), "is the varia suit worth it", "req-9");
    expect(item.params).toEqual({ routine: "items", subjects: ["Varia Suit"], game: "sm" });
  });

  it("reads a question that names both games as the game of its first area or boss", () => {
    const sm = overrideChatToGame(chat(), "bombs for kraid's lair, not the ice palace", "req-10");
    expect(sm.params.game).toBe("sm");
    expect(sm.params.subjects).toEqual(["Bombs", "Kraid"]);
    const alttp = overrideChatToGame(chat(), "ice palace is easier than kraid", "req-11");
    expect(alttp.params.game).toBe("alttp");
    expect(alttp.params.subjects).toEqual(["Ice Palace"]);
  });

  it("leaves Super Metroid's two letter names and everyday words as chat", () => {
    const d = chat();
    expect(overrideChatToGame(d, "hj sj pb g4 mb tonight?", "req-12")).toBe(d);
    expect(overrideChatToGame(d, "the speed of this wave of ice is super", "req-13")).toBe(d);
  });

  it("never touches a route other than chat", () => {
    for (const route of ["schedule", "streams", "players", "help", "game", "account"] as const) {
      const d: RoutingDecision = { route, confidence: 0.9, params: {}, reason: "r" };
      expect(overrideChatToGame(d, "kholdstare in the ice palace with the hookshot", "r")).toBe(d);
    }
    expect(logged("router.override")).toEqual([]);
  });
});
