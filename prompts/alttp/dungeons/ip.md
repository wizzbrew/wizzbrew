# Ice Palace (`ip`): Kholdstare

- **Boss:** **Kholdstare**. First **break its ice block** (**Fire Rod**, or **Bombos +
  sword**), then damage the eyes (**Fire Rod with magic**, or melee).
- **Layout:** 52 rooms of **ice physics**: Link slides on the floor. Requires the
  **Hammer** and **gloves** heavily, plus melting/burning obstacles (`canBurnThings`). A
  famous route uses the **Cane of Somaria block trick** and can involve a **bomb-jump / ice
  break** sequence break.
- **Enemies:** **Pengators** (sliding penguins), tons of **Blue/Red Bari** (jellyfish that
  split), Blobs, **Babasu**, **Stalfos Knights**.
- **Key facts:** **Hammer is essential.** Getting to the entrance requires crossing Lake
  Hylia (Flippers or the appropriate access). 2 standard small keys (6 with key-drops).
  **(vanilla)** gives the Blue Mail.
- **Difficulty:** **Hard.** Ice movement, splitting Bari, and item-heavy navigation.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Ice Palace (`ip`) | Kholdstare | 52 | 13 | 2 / 6 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Kholdstare** | Ice Palace | Break ice (Fire Rod, or Bombos + Sword) **then** damage (Fire Rod + magic, or melee) |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Blob (Zol).
- **Hookshot works (or standard weapons):** Blue/Red Bari, Pengator, Babasu.
- **Stalfos Knight:** Boomerang, Melee, or Bombs.
