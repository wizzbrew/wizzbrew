import { describe, expect, it } from "vitest";
import { GAME_DATA } from "../../src/game/data.js";
import { ROUTINE_NAMES } from "../../src/game/routines.js";
import {
  CACHE_1H,
  gameSystemBlocks,
  gameVolatileLines,
  MAX_SUBJECT_BLOCKS,
  planGame,
} from "../../src/game/slices.js";
import type { RoutingDecision } from "../../src/types.js";

function game(params: RoutingDecision["params"]): RoutingDecision {
  return { route: "game", confidence: 0.9, params, reason: "t" };
}

const data = (path: string): string => {
  const text = GAME_DATA[path];
  if (text === undefined) throw new Error(`no data for ${path}`);
  return text;
};
const texts = (d: RoutingDecision): string[] => gameSystemBlocks(d).map((b) => b.text);
const SEP = "\n\n---\n\n";

describe("Zelda 1 Randomizer subject blocks", () => {
  it("dungeon: the level's notes alone, whether the level or its boss was named", () => {
    for (const subjects of [["Level 6"], ["Gohma"], ["Dragon", "Gohma"]]) {
      const blocks = texts(game({ routine: "dungeon", game: "z1r", subjects }));
      expect(blocks.slice(1), subjects.join()).toEqual([data("z1r/dungeons/level6.md")]);
    }
    expect(texts(game({ routine: "dungeon", subjects: ["Aquamentus"] })).slice(1)).toEqual([
      data("z1r/dungeons/level1.md"),
    ]);
  });

  it("dungeon: Ganon is Level 9 once the game is Zelda 1, and Ganon's Tower in the other game", () => {
    expect(texts(game({ routine: "dungeon", game: "z1r", subjects: ["Ganon"] })).slice(1)).toEqual([
      data("z1r/dungeons/level9.md"),
    ]);
    expect(
      texts(game({ routine: "dungeon", game: "alttp", subjects: ["Ganon"] })).slice(1),
    ).toEqual([data("alttp/dungeons/gt.md")]);
    expect(texts(game({ routine: "dungeon", subjects: ["Ganon"] })).slice(1)).toEqual([
      data("alttp/dungeons/gt.md"),
    ]);
  });

  it("logic: the level notes plus its hand-written logic notes, like a rendered table", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(GAME_DATA[`z1r/logic/level${n}.md`], `level${n}`).toBeDefined();
    }
    const [, subject] = texts(game({ routine: "logic", game: "z1r", subjects: ["Level 7"] }));
    expect(subject).toBe(`${data("z1r/dungeons/level7.md")}\n${data("z1r/logic/level7.md")}`);
    expect(subject).toContain("Ladder");
    const nine = texts(game({ routine: "logic", game: "z1r", subjects: ["Patra"] }));
    expect(nine.slice(1)).toEqual([
      `${data("z1r/dungeons/level9.md")}\n${data("z1r/logic/level9.md")}`,
    ]);
    expect(nine[1]).toContain("Allow Important Items in 9");
  });

  it("overworld, items and general: one file each, whatever the names", () => {
    expect(
      texts(game({ routine: "overworld", game: "z1r", subjects: ["Level 4"] })).slice(1),
    ).toEqual([data("z1r/overworld.md")]);
    expect(texts(game({ routine: "items", game: "z1r", subjects: ["Raft"] })).slice(1)).toEqual([
      data("z1r/items.md"),
    ]);
    expect(texts(game({ routine: "general", game: "z1r" })).slice(1)).toEqual([
      data("z1r/general.md"),
    ]);
  });

  it("reads the game and the routine from the names when the router gave none", () => {
    expect(planGame(game({ subjects: ["Digdogger"] }))).toMatchObject({
      game: "z1r",
      routine: "dungeon",
      hasReference: true,
    });
    expect(planGame(game({ subjects: ["Magic Key"] }))).toMatchObject({
      game: "z1r",
      routine: "items",
    });
    expect(planGame(game({ subjects: ["Ganon"] })).game).toBe("alttp");
    expect(planGame(game({ subjects: ["Raft", "Hookshot"] })).game).toBe("alttp");
    expect(planGame(game({ game: "z1r" })).game).toBe("z1r");
  });

  it("follows the game for a name the games share", () => {
    const z1r = texts(game({ routine: "items", game: "z1r", subjects: ["Bombs"] })).slice(1);
    const sm = texts(game({ routine: "items", game: "sm", subjects: ["Bombs"] })).slice(1);
    const alttp = texts(game({ routine: "items", game: "alttp", subjects: ["Bombs"] })).slice(1);
    expect(z1r).toEqual([data("z1r/items.md")]);
    expect(sm).toEqual([data("sm/items.md")]);
    expect(alttp).toEqual([data("alttp/items.md")]);
  });

  it("orders several levels by key and merges the extras into the second block", () => {
    const a = texts(
      game({
        routine: "dungeon",
        game: "z1r",
        subjects: ["Level 8", "Level 2", "Level 5", "Level 1"],
      }),
    );
    const b = texts(
      game({
        routine: "dungeon",
        game: "z1r",
        subjects: ["Level 1", "Level 5", "Level 2", "Level 8"],
      }),
    );
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a[1]).toBe(data("z1r/dungeons/level1.md"));
    expect(a[2]).toBe(
      [
        data("z1r/dungeons/level2.md"),
        data("z1r/dungeons/level5.md"),
        data("z1r/dungeons/level8.md"),
      ].join(SEP),
    );
  });

  it("falls back to the items, then the orientation, and names what it could not place", () => {
    const items = game({ routine: "dungeon", game: "z1r", subjects: ["Red Ring"] });
    expect(texts(items).slice(1)).toEqual([data("z1r/items.md")]);
    expect(gameVolatileLines(items)).toEqual([]);
    const other = game({ routine: "dungeon", game: "z1r", subjects: ["Ice Palace", "xyzzy"] });
    expect(texts(other).slice(1)).toEqual([data("z1r/general.md")]);
    expect(gameVolatileLines(other)).toEqual([
      "Names not found in the loaded material: Ice Palace; xyzzy",
    ]);
  });

  it("does not use another game's notes when the router chose Zelda 1", () => {
    const d = game({ game: "z1r", routine: "items", subjects: ["Hookshot"] });
    expect(texts(d).join("")).not.toContain(data("alttp/items.md"));
    expect(texts(d).slice(1)).toEqual([data("z1r/items.md")]);
  });

  it("stays inside the breakpoint limit for every routine and level", () => {
    const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `level ${n}`);
    for (const routine of ROUTINE_NAMES) {
      for (const subjects of [levels, ["Gohma"], ["Raft", "Level 4"], []]) {
        const blocks = gameSystemBlocks(game({ routine, game: "z1r", subjects }));
        expect(blocks.length, routine).toBeLessThanOrEqual(1 + MAX_SUBJECT_BLOCKS);
        for (const b of blocks) expect(b.cache_control, routine).toEqual(CACHE_1H);
      }
    }
  });

  it("keeps each subject block a fraction of the whole Zelda 1 reference", () => {
    const total = Object.entries(GAME_DATA)
      .filter(([path]) => path.startsWith("z1r/"))
      .reduce((n, [, t]) => n + t.length, 0);
    for (const routine of ROUTINE_NAMES) {
      for (const subjects of [["Level 9"], ["Level 4"], ["Raft"], []]) {
        const subject = texts(game({ routine, game: "z1r", subjects }))
          .slice(1)
          .join("");
        expect(subject.length, routine).toBeLessThan(total / 2);
      }
    }
  });
});
