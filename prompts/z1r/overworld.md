# Overworld: regions, travel, secrets, dungeon access and hints

## Travel tools and secrets

The map is 128 screens and Link walks it one screen at a time. Four items change travel. The Raft crosses water at docks; the Stepladder crosses one-tile water gaps; the Power Bracelet pushes heavy rocks and gravestones; the Recorder reveals hidden dungeons at lakes and warps to dungeon entrances you have cleared. Secrets are bombable walls, burnable bushes, pushable rocks and gravestones, and Armos statues that hide stairs. Screen scrolling at special spots can cross a barrier, such as the river without the Ladder; a Z1R flag can also add bridges to the river.

## Regions

Z1R hints name ten zones.

| Zone | Code | Notes |
|---|---|---|
| Death Mountain | DM | Home of Level 9. Spectacle Rock, two rocks shaped like glasses, is the Level 9 entrance |
| The Graveyard ("at the grave") | GR | Gravestones; the Magical Sword lies under one |
| The Lost Woods ("Dead Woods") | DW | A maze: go north, west, south, west to get through |
| The Lost Hills | LH | Hint zone |
| The Coast | CO | Holds a heart container reachable by Ladder |
| The River | RV | Crossed with the Ladder, or by screen scrolling |
| The Lake ("by a lake") | LK | Lakes can hide dungeons the Recorder reveals |
| The Forest | FO | Hint zone |
| The Desert | DE | Hint zone |
| Close to Start | CS | Hint zone near where you begin |

Community names: Spectacle Rock is the Level 9 door, Candle Row is the burn bushes by Level 1, and Casino Corner is the northeast quadrant.

## Dungeon access

| Level | Vanilla gate | How shuffles change it |
|---|---|---|
| 1 | None: no item is needed | With cave shuffle any entrance can sit behind any gate |
| 2 | No item gate is documented; Z1R states the first quest lakes at Levels 2 and 7 always open with the Recorder | Mixed Overworld can swap locations |
| 3, 5, 6 | No item gate is documented | Same |
| 4 | Raft | Dungeon-only cave shuffle can put any level under a lake or behind the Raft; the wiki's own example is Level 2 needing the Raft and Level 4 needing the Recorder |
| 7 | Recorder, played at the pond where no fairy lives; the Bait must be bought for the Goriya door inside | Same |
| 8 | Candle, burning the tree at the entrance | Same |
| 9 | Eight Triforce pieces; Spectacle Rock bombed; Ladder to cross the river | The Level 9 entry setting can be 0 to 8 pieces, open, a random count, specific pieces or an item |

## How shuffles change the map

Overworld Quest picks the 1st, 2nd or Mixed layout. Mixed keeps a cave found in both quests and may make a one-quest cave inaccessible, and the number of caves is unchanged. Dungeon Quest picks the 1st, 2nd or Mixed dungeons (levels 1 to 6 from one quest and 7 to 9 from the other, either way round), generated Shapes with first quest item logic, or random options. Cave shuffle is Vanilla, Dungeons Only, Non-Dungeons Only, All Caves or Random, and Mixed Overworld forces All Caves. The Wood Sword cave and the Take Any Road caves can each be shuffled among the caves. Recorder to new dungeons sends warps to the new locations when on, to the 1st quest spots when off; Recorder to unbeaten dungeons warps to levels whose Triforce you lack. Dungeon room shuffle is Vanilla, In-dungeon (keeps the shape and balanced door counts), Full or Random. Mirror Overworld is another option.

## Hints as logic clues

Hints are not part of logic and can mislead, but these phrases say what a level or a cave needs.

| Phrase | Meaning |
|---|---|
| No Feat of Strength | No Bracelet or gravestone needed for a level or the White Sword cave |
| A Feat of Strength Will Lead To [item] | Bracelet or gravestone required |
| Sail Not to Save the Princess / Sail Across the Water | Raft not needed / needed |
| Play a Melody to Obtain [item] | Recorder needed (a level, the White Sword cave, or a Digdogger blocking an item) |
| Fire the Arrow to Obtain [item] | Bow needed (Gohma blocks the path) |
| Step Over the Water to Obtain [item] | Ladder needed |
| "Enemy" Guards The Compass | Level 9 compass room |

Dungeon hint phrases, in first quest level order: Aquamentus Awaits (Level 1), Dodongo Dwells (2), Manhandla Threatens (3), Gleeok Lurks (4), Digdogger Gazes (5), Gohma Creeps (6), Goriya Grumbles (7), Gleeok Returns (8) and "entrance to death" (9).

Old man lines that work as hints:

| Line | Meaning |
|---|---|
| DIGDOGGER HATES CERTAIN KIND OF SOUND. | Recorder |
| AIM AT THE EYES OF GOHMA. | Arrows to the eye |
| SPECTACLE ROCK IS AN ENTRANCE TO DEATH. | Level 9 door |
| PATRA HAS THE MAP. | Level 9 map |
| EYES OF SKULL HAS A SECRET. | Level 9 compass |
| THERE ARE SECRETS WHERE FAIRIES DON'T LIVE. | Play the Recorder at the pond with no fairy for Level 7 |
| SECRET POWER IS SAID TO BE IN THE ARROW. | The arrow-shaped rocks; second quest hints add SOUTH OF ARROW MARK HIDES A SECRET |

## Guarantees the generator keeps

| Rule | Detail |
|---|---|
| Bow path | The path to the Bow cannot include a room where Gohma must be killed |
| Recorder path | The path to the Recorder cannot include a room where Digdogger must be killed |
| Wand path (swordless) | The path to the Wand cannot include a room with a Gleeok or Pols Voice that must be killed |
| Ladder path | The path to the Ladder cannot include a room that needs the Ladder; in unshuffled rooms that covers Level 7 (both quests) and the Magic Key room in Level 8 (second quest) |
| Level 9 | Raft, Ladder, Recorder, Bow and Bracelet are kept out of Level 9 unless Allow Important Items in 9 is on; in swordless mode the Wand is also kept out |
| Raft | Never placed on an island that normally needs the Raft (original Level 4, or the island heart container) |
| Recorder | Never placed under the lake or in any location the Recorder opens |
| Shops | At least one Blue Candle shop is reachable from overworld items (not under a bush, on an island, or behind the Recorder or Ladder); at least one Arrow shop and one Bait shop need none of Raft, Recorder, Bracelet or Ladder |
| FAQ promise | Before Level 9 you can get the Ladder, Recorder, Bow, Power Bracelet and Raft; Silver Arrows may be needed for Ganon. This can fail if Level 9 is unlocked and important items are allowed in 9 |

## Level 9 facts

Vanilla needs 8 Triforce pieces; an old man blocks entry otherwise, and the lobby cannot be bombed out of, so the requirement cannot be skipped. Level 9 holds Gannon, Zelda, two staircase items, four hints and normally six transport stairs. Gannon's neighbors show -ROAR- instead of -LIFE-. Zelda's room has a shutter that opens only after Gannon dies and cannot be bombed into. Force Gannon Fight makes Gannon mandatory before Zelda. Gannon is invisible; sword hits turn him red and a Silver Arrow ends him. Swordless mode needs the Wand for Gannon.
