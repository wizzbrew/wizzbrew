# Palace of Darkness (`pod`): Helmasaur King

- **Boss:** **Helmasaur King**. Requires a **weapon (sword/hammer/bow)** *plus* **bombs or
  hammer** to shatter its mask, then damage it. The classic approach is bombs/hammer to break
  the face.
- **Layout:** 54 rooms and famously **very dark**, one of the heaviest **Lantern**
  dependencies in the game (76 lantern-gated interactions). Lots of **bomb-able walls** and
  **crystal switches** hit by the **Bow** or Bombs.
- **Enemies:** **Terrapins/Terrorpins** (need **Hammer + a weapon**), Blue/Red Bari,
  Mini-Helmasaurs, Eyegores, Kodongos.
- **Key facts:** **6 small keys**: the most key-dense dungeon by standard rules, with a
  complex 11-door key layout that makes key management a real puzzle. The **Bow** is
  essential (hitting the crystal switch across a gap, and the boss). **(vanilla)** gives the
  Hammer.
- **Difficulty:** **Hard.** Darkness + heavy key logic + a demanding boss.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Palace of Darkness (`pod`) | Helmasaur King | 54 | 16 | 6 / 6 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Helmasaur King** | Palace of Darkness | A weapon (Sword/Hammer/Bow) **and** Bombs or Hammer to break its mask |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Kodongo, Mini-Helmasaur.
- **Hookshot works (or standard weapons):** Blue/Red Bari.
- **Ice Rod works (or standard weapons):** Green Guards/Eyegore variants (`canKillGreenGuard`).
- **Terrapin/Terrorpin:** **Hammer + a weapon** (flip it with the Hammer, then hit it).
- **Red Eyegore:** **Bow required**: the only reliable way to drop it (blocks doors in EP and GT).
- **Green Eyegore:** standard weapons or Ice Rod.
