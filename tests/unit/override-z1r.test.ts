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

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("overrideChatToGame with Zelda 1", () => {
  it("moves a chat question that names a Zelda 1 boss to the game route with game z1r", () => {
    const d = overrideChatToGame(chat(), "how do i beat gohma", "req-1");
    expect(d.route).toBe("game");
    expect(d.params).toEqual({ routine: "dungeon", subjects: ["Gohma"], game: "z1r" });
    expect(planGame(d)).toMatchObject({ game: "z1r", hasReference: true });
  });

  it("moves a chat question with a multi-word item or level, as items or dungeon", () => {
    const item = overrideChatToGame(chat(), "is the red candle worth the rupees", "req-2");
    expect(item.params).toEqual({ routine: "items", subjects: ["Red Candle"], game: "z1r" });
    const level = overrideChatToGame(chat(), "is the magic key in level 8 worth it", "req-3");
    expect(level.params).toEqual({
      routine: "dungeon",
      subjects: ["Magic Key", "Level 8 (Lion)"],
      game: "z1r",
    });
    expect(planGame(level).blocks).toHaveLength(1);
  });

  it("leaves a single everyday word as chat", () => {
    for (const text of [
      "i lost my key again",
      "a ring, a letter and a candle",
      "the raft broke and the ladder fell, what a day",
      "moon, snake, lizard, dragon, demon, lion, eagle",
      "grab the bait and the wand and my heart sinks",
      "the whistle and the triforce and death mountain",
    ]) {
      const d = chat();
      expect(overrideChatToGame(d, text, "req-4"), text).toBe(d);
    }
  });

  it("leaves the two letter level names as chat", () => {
    const d = chat();
    expect(overrideChatToGame(d, "l1 l4 l9 tonight?", "req-5")).toBe(d);
  });

  it("keeps a shared name on A Link to the Past, as before", () => {
    const d = overrideChatToGame(chat(), "how many bombs", "req-6");
    expect(d.params).toEqual({ routine: "items", subjects: ["Bombs"], game: "alttp" });
    const ganon = overrideChatToGame(chat(), "how do i beat ganon", "req-7");
    expect(ganon.params.game).toBe("alttp");
  });

  it("reads a question that names two games as the game of its first area or boss", () => {
    const z1r = overrideChatToGame(chat(), "level 4 is easier than the ice palace", "req-8");
    expect(z1r.params.game).toBe("z1r");
    expect(z1r.params.subjects).toEqual(["Level 4 (Snake)"]);
    const alttp = overrideChatToGame(chat(), "ice palace is easier than level 4", "req-9");
    expect(alttp.params.game).toBe("alttp");
    expect(alttp.params.subjects).toEqual(["Ice Palace"]);
  });
});
