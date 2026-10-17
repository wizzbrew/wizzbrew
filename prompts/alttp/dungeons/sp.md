# Swamp Palace (`sp`): Arrghus

- **Boss:** **Arrghus**. Requires the **Hookshot** to pull off its orbiting "hooks," then a
  damage source (sword/hammer, or bow+rod, or bombs+rod with bottles/magic).
- **Layout:** 52 rooms built around **water**: the **Flippers** are the single most-required
  item here (36 references). You must **drain the water** by reaching the overworld **Dam**
  floodgate, which in standard (non-entrance-shuffle) rules also requires the **Magic
  Mirror** to complete.
- **Enemies:** **Hover** enemies (float over water, 25 of them), Stalfos, Blobs (Zols),
  Bari.
- **Key facts:** Only **1 standard small key** but the dungeon is a **water-flow puzzle**:
  progress is about raising/lowering water via switches, not keys. **(vanilla)** gives the
  Hookshot. Big Key present.
- **Difficulty:** Moderate; the water puzzle and Flippers/Hookshot dependency define it.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Swamp Palace (`sp`) | Arrghus | 52 | 12 | 1 / 6 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Arrghus** | Swamp Palace | **Hookshot** + a damage source (melee; or Bow + Rod; or Bombs + Rod + bottles/magic) |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Blob (Zol).
- **Hookshot works (or standard weapons):** Blue/Red Bari, Hover.
- **Boomerang works (or standard weapons):** Stalfos.
