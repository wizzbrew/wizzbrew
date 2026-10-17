# Castle Tower (`ct`, also "Agahnim's Tower"): the Light World climax

- **Boss:** **Agahnim**. Defeat him by **reflecting his energy balls** back, with the
  **Sword** or the **Bug Net** (and, in *swordless* play, the **Hammer**).
- **Layout:** 18 rooms; a vertical tower climb full of **dark rooms** (Lantern strongly
  recommended) and **"Clear the room" gauntlets** (all enemies must die to open the way).
- **Enemies:** Guards of all kinds: Blue Guards, Blue/Red Spear & Javelin Guards, Archers,
  Ball & Chain Troopers, and reflectable "Bolt" guards.
- **Key facts:** No Big Key, no map/compass, no prize. Requires a sword to reach and fight
  Agahnim. Beating Agahnim here breaks the barrier and opens the path to the Dark World.
- **Difficulty:** Moderate; the guard gauntlets and darkness are the main threats.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Castle Tower (`ct`) | Agahnim | 18 | 4 | 2 / 4 | no | none (Agahnim) |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Agahnim** | Castle Tower | Reflect his energy balls with **Sword or Bug Net** (Hammer also works in *swordless*) |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Ball & Chain trooper, Blue/Red Guards & Archers, Green Knife Guard.
- **Ice Rod works (or standard weapons):** Green Guards/Eyegore variants (`canKillGreenGuard`).

**"Clear the room" gates.** Some doorways only open once **every enemy in the room is defeated** (`canClearRoom`). These appear in Castle Tower, Eastern Palace, and heavily in Ganon's Tower, so having a weapon that can kill *each* enemy present matters.
