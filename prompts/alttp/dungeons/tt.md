# Thieves' Town (`tt`): Blind the Thief

- **Boss:** **Blind**. Beat with **melee (sword/hammer)** or a **Cane (Somaria/Byrna)**.
  Blind must be lured out of the "maiden" and away from light.
- **Layout:** 35 rooms; needs the **gloves** to lift blocks and **bombs** to open the attic
  route to reveal/defeat Blind.
- **Enemies:** **Red & Blue Zazaks** (Hokku-Bokku), **Blobs**, Cricket Rats, Stalfos, Gibos.
- **Key facts:** Only **1 standard small key**; the notable puzzle is rescuing the "maiden"
  and the attic bomb-drop to expose Blind. **(vanilla)** gives the Titan's Mitts.
- **Difficulty:** Easy to moderate.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Thieves' Town (`tt`) | Blind the Thief | 35 | 10 | 1 / 3 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Blind** | Thieves' Town | Melee or a Cane |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Blob (Zol), Zazaks (Hokku-Bokku), Gibo.
- **Hookshot works (or standard weapons):** Cricket Rat.
- **Boomerang works (or standard weapons):** Stalfos.
