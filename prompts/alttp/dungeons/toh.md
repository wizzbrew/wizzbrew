# Tower of Hera (`toh`): Moldorm

- **Boss:** **Moldorm**. **Melee only**: you need a **sword or hammer** (its tail is the
  weak point). Notorious for knocking Link off the ledge, forcing a re-climb.
- **Layout:** 28 rooms atop Death Mountain; features **crystal-switch** puzzles
  (`canHitSwitch`) and a torch-lighting requirement.
- **Enemies:** **Hardhat Beetles** (can't be killed conventionally: knock them aside;
  hammer works), Mini-Moldorms, and Kodongos.
- **Key facts:** Only **1 small key** and just a couple of key doors, one of the simplest
  key layouts. Reaching Hera requires Death Mountain access. **(vanilla)** holds the **Red
  Pendant** and gives the Moon Pearl.
- **Difficulty:** Easy layout, but **Moldorm itself frustrates** many players.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Tower of Hera (`toh`) | Moldorm | 28 | 8 | 1 / 1 | yes | Red Pendant |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Moldorm** | Tower of Hera | **Melee only** (Sword or Hammer): hit the tail |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Kodongo.
- **Hookshot works (or standard weapons):** Mini-Moldorm.
- **Hardhat Beetle:** **Melee only**: practically, knock them into pits; the **Hammer** reliably deals with them.
