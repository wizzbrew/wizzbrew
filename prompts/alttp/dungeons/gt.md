# Ganon's Tower (`gt`): the final dungeon

- **Boss:** **Agahnim 2** (a rematch that summons Moldorm/Lanmolas/Armos "mini-boss"
  reprises), leading toward Ganon.
- **Entry requirement:** Typically **7 Crystals** (configurable in the randomizer via the GT
  crystal-count / "locksmith" settings) to open the tower on Dark Death Mountain.
- **Layout:** The **largest dungeon, 94 rooms**, 28 item locations. It is a "greatest hits"
  of the whole game: **crystal-switch** puzzles, **bomb** walls, **Hookshot** gaps, **Cane
  of Somaria** platforming, torch lighting, **hover** sequence breaks, and **mini-boss
  reprises** (`canKillBoss|armos`, `|lanmolas`, `|moldorm`).
- **Enemies:** Almost every enemy in the game appears: Stalfos, Hardhat Beetles, Bari,
  Mini-Helmasaurs, Wizzrobes, Eyegores, Zazaks, Gibdos, Guards, and more.
- **Key facts:** **4 standard small keys** (8 with key-drops) and **28 item locations**:
  by far the most to collect. Requires a broad, near-complete inventory. The **Big Key**,
  **Bow** (Red Eyegores), **Hookshot**, **Somaria**, and **Bombs** are all effectively
  mandatory.
- **Difficulty:** **The hardest.** It assumes mastery of every mechanic.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Ganon's Tower (`gt`) | Agahnim 2 / Ganon | 94 | 28 | 4 / 8 | yes | none (final dungeon) |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Agahnim 2** | Ganon's Tower | Reflect energy balls with **Sword or Bug Net** (Hammer in *swordless*) |
| **Ganon** | (Pyramid) | Damage him, then finish with **Silver Arrows** |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Zazaks (Hokku-Bokku), Mini-Helmasaur.
- **Hookshot works (or standard weapons):** Blue/Red Bari.
- **Boomerang works (or standard weapons):** Stalfos.
- **Ice Rod works (or standard weapons):** Green Guards/Eyegore variants (`canKillGreenGuard`).
- **Gibdo (mummy):** **Melee only**: the Bow does *not* work.
- **Hardhat Beetle:** **Melee only**: practically, knock them into pits; the **Hammer** reliably deals with them.
- **Wizzrobe & Sluggula:** everything *except plain Bombs*: Sword/Hammer/Bow, Cane, Fire Rod, or Ice Rod + Hookshot.
- **Red Eyegore:** **Bow required**: the only reliable way to drop it (blocks doors in EP and GT).
- **Green Eyegore:** standard weapons or Ice Rod.

**"Clear the room" gates.** Some doorways only open once **every enemy in the room is defeated** (`canClearRoom`). These appear in Castle Tower, Eastern Palace, and heavily in Ganon's Tower, so having a weapon that can kill *each* enemy present matters.
