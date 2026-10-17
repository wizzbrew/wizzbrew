# Skull Woods (`sw`): Mothula

- **Boss:** **Mothula**. Beat with **melee (sword/hammer)**, or the **Fire Rod** (with
  enough magic), or the **Cane of Somaria** (with more magic).
- **Layout:** 31 rooms, unusual in that it has **many separate entrances** scattered across
  the Skull Woods forest: you drop between sections through the woods. Uses **bombs** and a
  **bomb-jump** sequence break in places.
- **Enemies:** **Gibdos** (mummies; need **melee**, bow won't kill them), Hardhat Beetles,
  Mini-Moldorms, Bari, Mini-Helmasaurs.
- **Key facts:** No Big Key door on the main path in some layouts; the boss is reached
  through a specific back section. **(vanilla)** gives the Fire Rod. The **Fire Rod** is
  handy against enemies and the boss.
- **Difficulty:** Moderate; the multi-entrance structure confuses newcomers.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Skull Woods (`sw`) | Mothula | 31 | 11 | 3 / 5 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Mothula** | Skull Woods | Melee, **or** Fire Rod (with magic), **or** Cane of Somaria (with more magic) |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Mini-Helmasaur.
- **Hookshot works (or standard weapons):** Blue/Red Bari, Mini-Moldorm.
- **Gibdo (mummy):** **Melee only**: the Bow does *not* work.
- **Hardhat Beetle:** **Melee only**: practically, knock them into pits; the **Hammer** reliably deals with them.
