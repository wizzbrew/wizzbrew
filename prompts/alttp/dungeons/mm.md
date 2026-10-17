# Misery Mire (`mm`): Vitreous

- **Boss:** **Vitreous** (a mass of eyeballs). Beat with **melee (sword/hammer)** or **bow +
  bombs**.
- **Entry requirement:** A **Medallion** must be used on the pad outside: **Bombos, Ether,
  or Quake** (which one is dungeon-specific and may be unknown until learned). Using the pad
  also requires a **sword**.
- **Layout:** 61 rooms; **dark** (heavy **Lantern** use, 50 references), lots of **crystal
  switches** (mostly blue-switch heavy), torch-lighting, and the **Cane of Somaria** for the
  boss room.
- **Enemies:** **Wizzrobes** (teleporting casters), Stalfos, **Sluggulas** (bomb-throwing
  slugs), Popos, Blobs.
- **Key facts:** The **Medallion gate** + darkness + **3 small keys** (6 with drops) make it
  logistically demanding. **(vanilla)** gives the Cane of Somaria.
- **Difficulty:** **Hard.** Medallion gate, darkness, Wizzrobes.

## Overview row

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Misery Mire (`mm`) | Vitreous | 61 | 11 | 3 / 6 | yes | Crystal |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

## Boss requirement

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Vitreous** | Misery Mire | Melee, **or** Bow + Bombs |

## Enemy notes (how the logic treats them)

Grouped by what is needed to kill them. "Standard weapons" below means the group **Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Blob (Zol).
- **Hookshot works (or standard weapons):** Popo/Popo2 (Zols).
- **Boomerang works (or standard weapons):** Stalfos.
- **Wizzrobe & Sluggula:** everything *except plain Bombs*: Sword/Hammer/Bow, Cane, Fire Rod, or Ice Rod + Hookshot.
