import type { RoutingDecision } from "../types.js";

// One short paragraph per routine. Each says what to answer and from which loaded material, in
// terms that hold for any game: areas, bosses, items and logic. Nothing here names a game, a
// setting or a sample question (L11). discord/leakguard.ts protects every one of them.
export type Routine = NonNullable<RoutingDecision["params"]["routine"]>;

const NOT_COVERED =
  "When the loaded material does not cover it, say so in one line rather than guessing.";

export const ROUTINE_PROMPTS: Record<Routine, string> = {
  dungeon: `Routine: dungeon, which covers one named area of the game, a dungeon or a region. The loaded notes hold that area's layout, boss, keys and enemies. Answer about whichever of those the person asked for, name the items and abilities that matter, and stay on the area they named. ${NOT_COVERED}`,
  logic: `Routine: logic. Answer what the logic requires to reach or clear the thing asked about: the items, abilities and keys, and where their order matters. When the loaded notes include a key door table, take key counts from it, giving the count for the door in question and how it changes when the table says so. When they hold location rules instead, state the rule for the location or area asked about, naming which logic, Casual or Tournament, when they differ. Use a glitched logic's section only when the question names it, and the no-glitch rules otherwise. State the logic's own rule plainly, with no preamble. ${NOT_COVERED}`,
  overworld: `Routine: overworld. Answer how to reach the entrance or overworld spot asked about and what getting there needs: items, abilities, which world or region you must be in, and any medallion or crystal gate. Use the entrance lines and the location notes in the loaded material, and stay on the one place asked about. ${NOT_COVERED}`,
  items: `Routine: items. Answer what the item does, its upgrades or levels, and what it unlocks or is needed for, from the loaded item notes. Stay on the item asked about. ${NOT_COVERED}`,
  general: `Routine: general. Answer from the orientation summary: how the game and its randomizer work, the worlds or regions, the terms the logic uses, and the tricks and glitches by name, at the depth the question needs. ${NOT_COVERED}`,
};

export const ROUTINE_NAMES = Object.keys(ROUTINE_PROMPTS) as [Routine, ...Routine[]];
