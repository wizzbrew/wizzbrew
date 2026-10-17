# Desert Palace (`dp`): Lanmolas

- **Boss:** **Lanmolas**. Beat with **sword, hammer, bow, Cane of Somaria, bombs + Cane of
  Byrna, or Fire/Ice Rod**.
- **Layout:** 32 rooms; multiple **entrances/portals** (the desert has east, west, north,
  and south entrances). Needs **Fire Rod or Lantern to light torches** in places
  (`canLightFires`), and **Pegasus Boots** help reach certain spots.
- **Enemies:** **Leevers** (sand burrowers; the dominant enemy, 27 spawns), Popos,
  **Devalants/Debirando** (sand-spitters), and a few Eyegores.
- **Key facts:** Getting inside historically needs the **Book of Mudora** (or entrance
  access in the randomizer). Reaching the boss involves lighting torches. 1 standard small
  key (4 with key-drops). **(vanilla)** holds the **Blue Pendant** and gives the Power Glove.
- **Difficulty:** Easy to moderate.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Desert Palace (`dp`) | Lanmolas | 32 | 8 | 1 / 4 | yes | Blue Pendant |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Lanmolas** | Desert Palace | Sword, Hammer, Bow, Cane of Somaria, Bombs + Cane of Byrna, or a Rod |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Leever, Debirando.
- **Hookshot works (or standard weapons):** Popo/Popo2 (Zols).
- **Ice Rod works (or standard weapons):** Green Guards/Eyegore variants (`canKillGreenGuard`).
- **Red Eyegore:** **Bow required**: the only reliable way to drop it (blocks doors in EP and GT).
- **Green Eyegore:** standard weapons or Ice Rod.
