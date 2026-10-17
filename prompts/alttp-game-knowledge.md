# A Link to the Past: Game Knowledge Base

## How to read this document

- **Item/boss/enemy requirements** describe what the *game logic* considers sufficient to
  defeat or pass something. They reflect real ALttP mechanics (what actually works), and
  are the same rules the randomizer uses to decide whether a location is "in logic."
- **"Rooms / sub-areas"** is the number of distinct logical regions the tracker models
  inside a dungeon. It is an excellent proxy for a dungeon's **size and complexity**.
- **Randomizer note.** In the randomizer, dungeon **prizes** (pendants/crystals), **items**,
  and optionally **entrances**, **bosses**, and **keys** are shuffled. Where a fact is true
  only in the *vanilla* (unrandomized) game, it is marked **(vanilla)**.
- Short dungeon codes used throughout: `hc` Hyrule Castle, `ct` Castle Tower, `ep` Eastern
  Palace, `dp` Desert Palace, `toh` Tower of Hera, `pod` Palace of Darkness, `sp` Swamp
  Palace, `sw` Skull Woods, `tt` Thieves' Town, `ip` Ice Palace, `mm` Misery Mire,
  `tr` Turtle Rock, `gt` Ganon's Tower.

---

## The two worlds

The game world is split into two overlapping maps:

- **Light World**: the starting overworld (~118 distinct regions modeled).
- **Dark World**: a corrupted parallel map (~101 distinct regions modeled), reached via
  portals, the pyramid, or Magic Mirror interactions.

**The Bunny mechanic.** In the Dark World *without the Moon Pearl*, Link is transformed into
a helpless **bunny** who cannot use items, swing a sword, or attack. The **Moon Pearl** keeps
Link in his normal form in the Dark World. (In *Inverted* mode the worlds' roles swap.)

- **Bunny**: can only walk and pick up some free-standing items; cannot interact with most
  locations.
- **Superbunny**: a bunny who has entered an interior (via a mirror-cancel), and can open
  chests, swing sword, dash, and even "die-to-revive" back to Link form inside dungeons.

**Overworld traversal requirements** (most common gating items, by frequency in the logic):
Moon Pearl (Dark World form), Magic Mirror (world-switching), Flippers (deep water),
Power Glove / Titan's Mitts (lifting rocks), Hammer (smashing pegs), Pegasus Boots
(dashing into bonk trees/rocks), and Bombs (blowing open cracked walls).

---

## Items and equipment

| Item | Levels / notes |
|------|----------------|
| **Sword** | 4 levels: Fighter → Master → Tempered → Golden. Sword ≥2 gives **spin/sword beams** (at full health). |
| **Bow** | Bow, Silver Arrows, Bow+Arrows, Bow+Silver. Needs arrows (or silvers) to actually fire. Silver Arrows are required to finish Ganon. |
| **Boomerang** | Blue and/or Red. Stuns enemies and grabs items; Red has longer range. |
| **Hookshot** | Pulls Link to objects, stuns/kills soft enemies, crosses gaps. |
| **Bombs** | Damage enemies, open cracked walls, hit switches. |
| **Fire Rod / Ice Rod** | Magic projectiles ("rods"). Fire Rod lights torches and burns webs; Ice Rod freezes. |
| **Cane of Somaria / Cane of Byrna** | Magic "canes". Somaria makes blocks; Byrna gives a damaging shield. |
| **Hammer (Magic Hammer)** | Smashes pegs/Hardhat Beetles; counts as a melee weapon. |
| **Bombos / Ether / Quake Medallions** | Screen-clearing magic; also used as **dungeon entry keys** (see Medallions). |
| **Lantern** | Lights **dark rooms**; also lights torches. Many dungeons are unnavigable safely without it. |
| **Magic Mirror** | Warp to the other world / back to a dungeon entrance. |
| **Pegasus Boots** | Dash; used to bonk trees/rocks for hidden items and to cross certain gaps. |
| **Power Glove / Titan's Mitts** | Lift light rocks / heavy dark rocks respectively. |
| **Flippers** | Swim in deep water. |
| **Moon Pearl** | Prevents Dark World bunny transformation. |
| **Magic Cape** | Temporary invincibility/invisibility; passes energy barriers. |
| **Bug Net** | Catches bugs/fairies; **reflects Agahnim's energy balls** (an alternative to the sword against Agahnim). |
| **Book of Mudora** | Reads Hylian; needed to read the Ether/Bombos tablets (with sword beams). |
| **Bottles** | Up to 4. Hold potions, fairies, or bees; extend usable magic for tough bosses. |
| **Shield** | Fighter → Fire → Mirror. Mirror Shield blocks Lasers (e.g. Turtle Rock beamos/lasers). |
| **Mail** | Green (base) → Blue → Red; reduces damage taken. |
| **Half Magic** | Halves magic consumption: effectively doubles rod/cane/medallion uses. |
| **Flute** | Summons a bird for fast overworld travel once activated. |

---

## Dungeon overview

Sorted roughly from smallest/simplest to largest/most complex (by modeled room count).

| Dungeon | Boss | Rooms | Item locations | Small keys (std / keydrop) | Big Key | Prize (vanilla) |
|---------|------|:----:|:----:|:----:|:----:|------|
| Hyrule Castle (`hc`) | Ball & Chain Guard | 11 | 5 | 1 / 4 (+BK drop) | no | rescue Zelda |
| Castle Tower (`ct`) | Agahnim | 18 | 4 | 2 / 4 | no | none (Agahnim) |
| Tower of Hera (`toh`) | Moldorm | 28 | 8 | 1 / 1 | yes | Red Pendant |
| Skull Woods (`sw`) | Mothula | 31 | 11 | 3 / 5 | yes | Crystal |
| Eastern Palace (`ep`) | Armos Knights | 32 | 9 | 0 / 2 | yes | Green Pendant |
| Desert Palace (`dp`) | Lanmolas | 32 | 8 | 1 / 4 | yes | Blue Pendant |
| Thieves' Town (`tt`) | Blind the Thief | 35 | 10 | 1 / 3 | yes | Crystal |
| Ice Palace (`ip`) | Kholdstare | 52 | 13 | 2 / 6 | yes | Crystal |
| Swamp Palace (`sp`) | Arrghus | 52 | 12 | 1 / 6 | yes | Crystal |
| Palace of Darkness (`pod`) | Helmasaur King | 54 | 16 | 6 / 6 | yes | Crystal |
| Turtle Rock (`tr`) | Trinexx | 55 | 16 | 4 / 6 | yes | Crystal |
| Misery Mire (`mm`) | Vitreous | 61 | 11 | 3 / 6 | yes | Crystal |
| Ganon's Tower (`gt`) | Agahnim 2 / Ganon | 94 | 28 | 4 / 8 | yes | none (final dungeon) |

*"Small keys (std / keydrop)"* = number of small keys in standard rules vs. when
**key-drop shuffle** is on (keys also drop from pots and enemies). "Rooms" counts modeled
logical regions and is a proxy for complexity/length.

---

## Dungeons in detail

### Hyrule Castle (`hc`): the prologue dungeon
- **Boss:** Ball & Chain Guard (a mini-boss guarding the entry). Always defeatable: no
  special item required.
- **Layout:** Small (11 rooms), leads down into the dark **Sewers**.
- **Enemies:** Cricket Rats and Snakes: trivial.
- **Key facts:** The **Lantern** matters here: the Sewers are a **dark room**. Without it,
  navigating in the dark is a sequence break. Has 1 small key (up to 4 with key-drops) and a
  **Big Key that drops from a guard** in a fixed early spot. **(vanilla)** This is where Link
  rescues Princess Zelda and takes her to the Sanctuary.
- **Difficulty:** Very easy; the game's tutorial dungeon.

### Castle Tower (`ct`, also "Agahnim's Tower"): the Light World climax
- **Boss:** **Agahnim**. Defeat him by **reflecting his energy balls** back, with the
  **Sword** or the **Bug Net** (and, in *swordless* play, the **Hammer**).
- **Layout:** 18 rooms; a vertical tower climb full of **dark rooms** (Lantern strongly
  recommended) and **"Clear the room" gauntlets** (all enemies must die to open the way).
- **Enemies:** Guards of all kinds: Blue Guards, Blue/Red Spear & Javelin Guards, Archers,
  Ball & Chain Troopers, and reflectable "Bolt" guards.
- **Key facts:** No Big Key, no map/compass, no prize. Requires a sword to reach and fight
  Agahnim. Beating Agahnim here breaks the barrier and opens the path to the Dark World.
- **Difficulty:** Moderate; the guard gauntlets and darkness are the main threats.

### Eastern Palace (`ep`): Armos Knights
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

### Desert Palace (`dp`): Lanmolas
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

### Tower of Hera (`toh`): Moldorm
- **Boss:** **Moldorm**. **Melee only**: you need a **sword or hammer** (its tail is the
  weak point). Notorious for knocking Link off the ledge, forcing a re-climb.
- **Layout:** 28 rooms atop Death Mountain; features **crystal-switch** puzzles
  (`canHitSwitch`) and a torch-lighting requirement.
- **Enemies:** **Hardhat Beetles** (can't be killed conventionally: knock them aside;
  hammer works), Mini-Moldorms, and Kodongos.
- **Key facts:** Only **1 small key** and just a couple of key doors, one of the simplest
  key layouts. Reaching Hera requires Death Mountain access. **(vanilla)** holds the **Red
  Pendant** and gives the Moon Pearl.
- **Difficulty:** Easy layout, but **Moldorm itself frustrates** many players.

### Palace of Darkness (`pod`): Helmasaur King
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

### Swamp Palace (`sp`): Arrghus
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

### Skull Woods (`sw`): Mothula
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

### Thieves' Town (`tt`): Blind the Thief
- **Boss:** **Blind**. Beat with **melee (sword/hammer)** or a **Cane (Somaria/Byrna)**.
  Blind must be lured out of the "maiden" and away from light.
- **Layout:** 35 rooms; needs the **gloves** to lift blocks and **bombs** to open the attic
  route to reveal/defeat Blind.
- **Enemies:** **Red & Blue Zazaks** (Hokku-Bokku), **Blobs**, Cricket Rats, Stalfos, Gibos.
- **Key facts:** Only **1 standard small key**; the notable puzzle is rescuing the "maiden"
  and the attic bomb-drop to expose Blind. **(vanilla)** gives the Titan's Mitts.
- **Difficulty:** Easy to moderate.

### Ice Palace (`ip`): Kholdstare
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

### Misery Mire (`mm`): Vitreous
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

### Turtle Rock (`tr`): Trinexx
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

### Ganon's Tower (`gt`): the final dungeon
- **Boss:** **Agahnim 2** (a rematch that summons Moldorm/Lanmolas/Armos "mini-boss"
  reprises), leading toward Ganon.
- **Entry requirement:** Typically **7 Crystals** (configurable in the randomizer via the GT
  crystal-count / "locksmith" settings) to open the tower on Dark Death Mountain.
- **Layout:** The **largest dungeon, 94 rooms**, 28 item locations. It is a "greatest hits"
  of the whole game: **crystal-switch** puzzles, **bomb** walls, **Hookshot** gaps, **Cane
  of Somaria** platforming, torch lighting, **hover** sequence breaks, and **mini-boss
  reprises** (`canKillBoss|armos`, `|lanmolas`, `|moldorm`).
- **Enemies:** Almost every enemy in the game appears: Stalfos, Hardhat Beetles, Bari,
  Mini-Helmasaurs, Wizzrobes, Eyegores, Zazaks, Gibdos, Guards, and more.
- **Key facts:** **4 standard small keys** (8 with key-drops) and **28 item locations**:
  by far the most to collect. Requires a broad, near-complete inventory. The **Big Key**,
  **Bow** (Red Eyegores), **Hookshot**, **Somaria**, and **Bombs** are all effectively
  mandatory.
- **Difficulty:** **The hardest.** It assumes mastery of every mechanic.

---

## Bosses: how to defeat each

These are the exact item combinations the logic accepts. "Melee" = **Sword or Hammer**.
"Rod" = Fire Rod or Ice Rod. "Cane" = Cane of Somaria or Cane of Byrna.

| Boss | Dungeon | Defeat requirement |
|------|---------|--------------------|
| **Armos Knights** | Eastern Palace | Sword, Hammer, Bow, Boomerang, a Cane, or a Rod (very flexible) |
| **Lanmolas** | Desert Palace | Sword, Hammer, Bow, Cane of Somaria, Bombs + Cane of Byrna, or a Rod |
| **Moldorm** | Tower of Hera | **Melee only** (Sword or Hammer): hit the tail |
| **Helmasaur King** | Palace of Darkness | A weapon (Sword/Hammer/Bow) **and** Bombs or Hammer to break its mask |
| **Arrghus** | Swamp Palace | **Hookshot** + a damage source (melee; or Bow + Rod; or Bombs + Rod + bottles/magic) |
| **Mothula** | Skull Woods | Melee, **or** Fire Rod (with magic), **or** Cane of Somaria (with more magic) |
| **Blind** | Thieves' Town | Melee or a Cane |
| **Kholdstare** | Ice Palace | Break ice (Fire Rod, or Bombos + Sword) **then** damage (Fire Rod + magic, or melee) |
| **Vitreous** | Misery Mire | Melee, **or** Bow + Bombs |
| **Trinexx** | Turtle Rock | **Fire Rod + Ice Rod** + a finisher (Hammer, or a strong Sword / enough magic) |
| **Agahnim** | Castle Tower | Reflect his energy balls with **Sword or Bug Net** (Hammer also works in *swordless*) |
| **Agahnim 2** | Ganon's Tower | Reflect energy balls with **Sword or Bug Net** (Hammer in *swordless*) |
| **Ganon** | (Pyramid) | Damage him, then finish with **Silver Arrows** |

---

## Enemies: how the logic treats them

Grouped by what is needed to kill them. "Standard weapons" below means the group
**Sword/Hammer, Bow, Bombs, or a Cane** (`melee_bow_bomb_cane`).

- **Killable by almost anything (standard weapons):** Ball & Chain trooper, Blob (Zol),
  Blue/Red Guards & Archers, Zazaks (Hokku-Bokku), Kodongo, Leever, Mini-Helmasaur, Pokey,
  Snake, Debirando, Gibo, Green Knife Guard.
- **Hookshot works (or standard weapons):** Popo/Popo2 (Zols), Blue/Red Bari, Cricket Rat,
  Hover, Mini-Moldorm, Pengator, Babasu.
- **Boomerang works (or standard weapons):** Stalfos, Floating Skull.
- **Stalfos Knight:** Boomerang, Melee, or Bombs.
- **Ice Rod works (or standard weapons):** Green Guards/Eyegore variants (`canKillGreenGuard`).
- **Gibdo (mummy):** **Melee only**: the Bow does *not* work.
- **Hardhat Beetle:** **Melee only**: practically, knock them into pits; the **Hammer**
  reliably deals with them.
- **Terrapin/Terrorpin:** **Hammer + a weapon** (flip it with the Hammer, then hit it).
- **Wizzrobe & Sluggula:** everything *except plain Bombs*: Sword/Hammer/Bow, Cane, Fire
  Rod, or Ice Rod + Hookshot.
- **Red Eyegore:** **Bow required**: the only reliable way to drop it (blocks doors in EP
  and GT).
- **Green Eyegore:** standard weapons or Ice Rod.

**"Clear the room" gates.** Some doorways only open once **every enemy in the room is
defeated** (`canClearRoom`). These appear in Castle Tower, Eastern Palace, and heavily in
Ganon's Tower, so having a weapon that can kill *each* enemy present matters.

---

## Medallions & special entry requirements

- **Misery Mire** and **Turtle Rock** each require a **Medallion** (Bombos, Ether, or Quake)
  used on the pad at the entrance. The correct medallion is **dungeon-specific**; until it's
  known it may show as "unknown," and having all three guarantees entry. Using the pad also
  requires a **Sword** (`canUseMedallionPad`).
- **Ganon's Tower** opens with a **crystal requirement** (standard **7 Crystals**;
  configurable, including a "locksmith" mode).
- **Overworld tablets**: the **Ether Tablet** and **Bombos Tablet** are read with the
  **Book of Mudora** plus **sword beams** (Sword ≥2 at full health, or swordless tricks).
- **Master Sword Pedestal**: grants the sword when Link brings **all three Pendants**
  (`canPullPedestal`).
- **The Dam / Sunken Treasure**: pulling the floodgate lever at the **Dam** drains Swamp
  Palace and reveals the Sunken Treasure heart piece.

---

## Overworld & notable locations

The overworld is dense with items. Common access patterns:

- **Bonk trees & rocks:** dash with **Pegasus Boots** into "pull trees" / bonk rocks for
  hidden drops (needs Moon Pearl in the Dark World).
- **Rock drops:** lift with **Power Glove** (light) or **Titan's Mitts** (dark rocks).
- **Water spots:** **Flippers** for Zora's Ledge, Lake Hylia Island, the Hobo, etc.
- **NPC quests / followers:** Old Man (escort down the mountain), Kiki the ape (opens Palace
  of Darkness), the Frog/Blacksmith (partner rescue), the Purple Chest (delivered to the
  "Middle Aged Man"), the Big Bomb (bought with red crystals to blow open the Pyramid Fairy).

**Notable named Light World locations:** Master Sword Pedestal, Ether Tablet, Bombos Tablet,
Spectacle Rock, Floating Island, King Zora, Zora's Ledge, Maze Race, Flute Spot (dig),
Desert Ledge, Lake Hylia Island, Sunken Treasure, Sahasrahla, Bottle Merchant, Sick Kid,
Magic Bat, Library, Blacksmith, Mushroom, Lumberjack Tree.

**Notable named Dark World locations:** Catfish, Pyramid (Ganon), Pyramid Fairy, Digging
Game, the Frog & Stumpy, Bumper Cave Ledge, Turtle Medallion Pad, Kiki, Dark Blacksmith
Ruins.

---

## Caves & interiors (with collectible items)

There are ~58 modeled caves/interiors that contain items. Highlights:

- **Multi-item caves:** **Paradox Cave** (7 items: 5 lower + 2 upper), **Hype Cave**
  (5 items incl. the "Generous Guy"), **Mini Moldorm Cave** (5 items), **Blind's Hideout**
  (5 items), **Kakariko Well** (5 items), **Hookshot Cave** (4 items across bonk/hook
  islands), **Superbunny Cave** (2 items, in the Dark World; traversed as a superbunny).
- **Single-item / puzzle caves:** **Ice Rod Cave**, **Mimic Cave** (near Turtle Rock; needs
  the Mirror + Turtle Rock progress), **Checkerboard Cave**, **Bonk Rock Cave**, **Graveyard
  Cave**, **King's Tomb** (needs Boots + Mitts/Mirror), **Spike Cave** (Byrna/Cape to survive
  the spikes), **Aginah's Cave**, **Cave 45**, **Waterfall of Wishing** (throw items in).
- **Shops:** many shops (Kakariko, Lake Hylia, Potion, Village of Outcasts, Dark Death
  Mountain, Red Shield Shop, the Capacity Upgrade fairy for bomb/arrow capacity).
- **Quest interiors:** Sahasrahla's Hut, Sick Kid's House, Library, Blacksmiths' Hut, Chest
  Game, Archery Game, Big Bomb Shop, Mire Shed, Brewery, C-Shaped House, Chicken House.

---

## Game mechanics & terminology (glossary)

- **Dark Room**: an unlit room; the **Lantern** lights it. Navigating without it is a
  well-known *sequence break* ("dark room navigation"). Heaviest in Palace of Darkness,
  Hyrule Castle Sewers, Misery Mire, Castle Tower, and Eastern Palace.
- **Crystal Switch**: an orange/blue switch that raises/lowers colored barriers. Hit it with
  most weapons (`canHitSwitch`), or from range with Bow/Boomerang/Rod/Somaria/Bombs
  (`canHitRangedSwitch`). Common in PoD, TR, Ice Palace, Misery Mire, Ganon's Tower.
- **Small Key / Big Key**: Small Keys open locked doors within a dungeon; the **Big Key**
  opens the big chest and boss door. **Key logic** (which door to spend a key on) is a real
  puzzle in key-dense dungeons (PoD especially). With **key-drop shuffle**, keys also come
  from pots and enemy drops.
- **Medallion Pad**: the entry gate for Misery Mire and Turtle Rock (see Medallions).
- **Prizes**: each cleared dungeon yields a **Pendant** (green/blue/red) or a **Crystal**
  (blue crystals, plus 2 special **Red Crystals** needed to buy the Big Bomb). 7 Crystals are
  the classic requirement to enter Ganon's Tower.
- **Superbunny / die-to-revive**: a bunny who enters an interior can act (superbunny) and,
  in a dungeon, **die to revive as full Link**. In no-glitch logic this is treated as a
  sequence break.
- **Followers**: NPCs who must be escorted: the Old Man, Kiki (opens PoD), the Frog and the
  Blacksmith partner, etc.

---

## Randomizer-specific concepts (brief)

- **Logic status** the tracker assigns to a location: *unavailable* → *possible* (reachable
  only if keys are used optimally) → *out-of-logic / "ool"* (reachable only via a sequence
  break) → *available*.
- **World states:** *Open* (start in Light World), *Standard* (guided Hyrule-Castle
  intro), *Inverted* (start in the Dark World; Moon Pearl rules flip).
- **Entrance Randomizer** shuffles which door leads where, so vanilla item/dungeon
  placements no longer hold.
- **Sequence breaks / glitches** the logic can optionally allow include: Dark Room
  Navigation, Bomb Jumps, Hovering (Boots), Fake Flippers, Water Walk, Mirror Super Bunny,
  Somaria "Ice Break," Herapot, Mimic Clip, Moldorm Bounce, and several clip tricks. When a
  location is reachable *only* via one of these, it's flagged **out-of-logic**.
