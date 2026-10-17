# Turtle Rock (`tr`): Trinexx

- **Boss:** **Trinexx**. Requires **both the Fire Rod and the Ice Rod** (alternate freezing
  and burning the heads), then finish with the **Hammer** or a strong sword/magic.
- **Entry requirement:** A **Medallion** on the pad (Bombos/Ether/Quake, dungeon-specific),
  plus a **sword** to use it.
- **Layout:** 55 rooms; the **Cane of Somaria** is the signature item (56 references): it
  creates blocks to ride the moving platforms and is mandatory in several rooms. Features
  **Lasers/Beamos** that the **Mirror Shield** (or Cape/Byrna) lets you pass
  (`canAvoidLasers`), plus many crystal switches.
- **Enemies:** Blobs, **Pokeys** (Chain Chomps area), Bari, Floating Skulls,
  Mini-Helmasaurs.
- **Key facts:** On Death Mountain; entry needs the Medallion, and the interior needs the
  **Cane of Somaria** and ideally the **Mirror Shield**. Two rods + hammer for the boss make
  it the most **item-gated** dungeon. **(vanilla)** gives the Mirror Shield.
- **Difficulty:** **Very hard.** The most item-demanding dungeon before Ganon's Tower.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Turtle Rock (`tr`) | Trinexx | 55 | 16 | 4 / 6 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Trinexx** | Turtle Rock | **Fire Rod + Ice Rod** + a finisher (Hammer, or a strong Sword / enough magic) |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Blob (Zol), Mini-Helmasaur, Pokey.
- **Hookshot works (or standard weapons):** Blue/Red Bari.
- **Boomerang works (or standard weapons):** Floating Skull.
