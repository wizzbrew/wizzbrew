import { describe, expect, it, vi } from "vitest";
import { GAME_IDS, GAME_NAMES } from "../../src/game/catalog.js";
import { ROUTINE_NAMES } from "../../src/game/routines.js";
import { gameSystemBlocks, gameVolatileLines, planGame } from "../../src/game/slices.js";
import type { RoutingDecision } from "../../src/types.js";

// The game data is a generated constant, so this file stands in an empty one: a game added to
// the catalog before its notes exist must still get an answer, with a line saying so.
vi.mock("../../src/game/data.js", () => ({ GAME_DATA: {} }));

function game(params: RoutingDecision["params"]): RoutingDecision {
  return { route: "game", confidence: 0.9, params, reason: "t" };
}

describe("a game with no reference material", () => {
  it("loads nothing but the instructions and says so in the volatile lines", () => {
    for (const id of GAME_IDS) {
      for (const routine of ROUTINE_NAMES) {
        const d = game({ game: id, routine, subjects: ["Ice Palace", "Kraid"] });
        const plan = planGame(d);
        expect(plan.hasReference, `${id} ${routine}`).toBe(false);
        expect(plan.blocks, `${id} ${routine}`).toEqual([]);
        expect(gameSystemBlocks(d), `${id} ${routine}`).toHaveLength(1);
        expect(gameVolatileLines(d), `${id} ${routine}`).toEqual([
          `No reference material is loaded for ${GAME_NAMES[id]}.`,
        ]);
      }
    }
  });
});
