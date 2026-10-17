# Eastern Palace (`ep`): Armos Knights

- **Boss:** **Armos Knights**. Very flexible: **sword, hammer, bow, boomerang, Cane of
  Somaria/Byrna, or Fire/Ice Rod** all work.
- **Layout:** 32 rooms with a notable **dark section** (the "Dark Square"/"Darkness" rooms
  need the **Lantern**).
- **Enemies:** Stalfos, Popo (Zols), **Green Eyegores** and **Red Eyegores** (the Red ones
  can *only be defeated with the Bow*), and the Cannonball hazard rooms.
- **Key facts:** The **Bow** is thematically the dungeon's tool: Red Eyegores block progress
  and need it. 0 standard small keys (2 with key-drops), 1 Big Key. **(vanilla)** holds the
  **Green Pendant** and its prize item is the Bow.
- **Difficulty:** Easy to moderate; mostly gated by having the Bow and a light source.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Eastern Palace (`ep`) | Armos Knights | 32 | 9 | 0 / 2 | yes | Green Pendant |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Armos Knights** | Eastern Palace | Sword, Hammer, Bow, Boomerang, a Cane, or a Rod (very flexible) |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Hookshot works (or standard weapons):** Popo/Popo2 (Zols).
- **Boomerang works (or standard weapons):** Stalfos.
- **Ice Rod works (or standard weapons):** Green Guards/Eyegore variants (`canKillGreenGuard`).
- **Red Eyegore:** **Bow required**: the only reliable way to drop it (blocks doors in EP and GT).
- **Green Eyegore:** standard weapons or Ice Rod.

**"Clear the room" gates.** Some doorways only open once **every enemy in the room is defeated** (`canClearRoom`). These appear in Castle Tower, Eastern Palace, and heavily in Ganon's Tower, so having a weapon that can kill *each* enemy present matters.
