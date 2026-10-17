# The Legend of Zelda (NES) and the Zelda 1 Randomizer: orientation

The Legend of Zelda is the 1986 original (Famicom Disk System in Japan, the NES cartridge in 1987 in North America): a top-down action adventure with an open, non-linear overworld of 128 screens (16 columns by 8 rows) and no overworld map screen. Z1R, the Zelda 1 Randomizer, shuffles it. These notes cover the base game and Z1R, the randomizer by Fred Coughlin ("fcoughlin"); other Zelda randomizers are not covered.

## The game in brief

Japan: 21 February 1986 on the Famicom Disk System, a launch title. North America: 1987 on cartridge. Designed and directed by Shigeru Miyamoto and Takashi Tezuka, music by Koji Kondo, programming by Toshihiko Nakago. Travel is on foot, one screen at a time; secrets are bombable walls, burnable bushes, pushable rocks and gravestones, and Armos statues that hide stairs.

## The story

Ganon invades Hyrule and steals the Triforce of Power. Princess Zelda splits the Triforce of Wisdom into eight fragments and hides them in dungeons across the land before she is captured. Her nursemaid Impa escapes to find a hero, and a boy named Link answers. Link gathers the eight fragments, enters Ganon's lair on Death Mountain (Level 9), defeats him with the Silver Arrow, takes the Triforce of Power and rescues Zelda.

## The second quest

Beat the game, then start the file with the sword icon to play the Second Quest: the same world remixed, with dungeon entrances moved, levels rearranged and some hints changed. The Z1R wiki names the second quest dungeon shapes E, A, L, D, Z, Wizard Hat, Spiral 1, Spiral 2 and Pig's Head. Level order differs: Dodongo is Level 2 in the first quest and Level 3 in the second, and the second Gleeok (Gleeok Returns) is Level 8 in the first quest and Level 7 in the second.

## How players talk about it

| Term | Meaning |
|---|---|
| Screen scroll, pan scroll | Using special spots to move across a barrier, such as the river without the Ladder; twelve spots are on the wiki. Pan scroll is named after the runner Panulphe |
| Block clip | Glitch for moving through a dungeon block; the Prevent Clipping flag removes it |
| Up+A | On the second controller at the Start menu, Continue or Save and Quit to reset a room |
| Bomb force | Kill nine enemies without damage and the tenth with a bomb to force a Bomb Pack drop |
| Candle Row | The burn bushes by Level 1 |
| Spectacle Rock | Two rocks shaped like glasses on Death Mountain, the Level 9 entrance |
| Casino Corner, Money Making Game | The northeast quadrant; the gambling cave, also called the Gamblematic 9000 |
| Mugger | Dungeon room: "Leave your life or money" costs a heart container or 50 rupees |
| Swordless | A run with no sword; bombs and the Wand fight for you |
| Gannon Kill Kit | Bow and Silver Arrows together |
| Dorito, tringle, chip | A Triforce piece |
| Poverty seed, why-force | A low-rupee seed; picking up the Triforce by accident |
| Mags | The Magical Sword, which is not the Master Sword |
| Banger | A race of ten people; every extra ten adds a certification |

## The famous lines

| Line | Where |
|---|---|
| IT'S DANGEROUS TO GO ALONE! TAKE THIS. | The Wood Sword cave on the first screen |
| EASTMOST PENNINSULA IS THE SECRET. | Level 1 hint; a cave in the northeast has 100 rupees |
| 10TH ENEMY HAS THE BOMB. | The bomb force trick |
| DODONGO DISLIKES SMOKE. | Bombs kill Dodongo; it eats them |
| WALK INTO THE WATERFALL. | The old woman's cave behind the waterfall |
| GRUMBLE, GRUMBLE... | The Hungry Goriya, who wants Bait |
| LEAVE YOUR LIFE OR MONEY. | The mugger room choice |
| IT'S A SECRET TO EVERYBODY. | The moblin who gives rupees |

## Ten fun facts

1. The first Zelda was a Famicom Disk System launch title on 21 February 1986.
2. Koji Kondo meant to use Ravel's Bolero for the title music, had to replace it for copyright reasons, and wrote the overworld theme in about a day.
3. It was one of the first cartridges with a save battery.
4. Development ran alongside Super Mario Bros.; Zelda was deliberately non-linear, the opposite of Mario.
5. It was the first NES game to sell over one million cartridges in the United States.
6. It sold about 6.51 million copies worldwide.
7. The Second Quest unlocks after you finish the game and is a remixed set of dungeons.
8. The overworld is 128 screens.
9. The Magical Sword is nicknamed Mags or Maggie, and the community stresses it is not the Master Sword.
10. In Z1R slang a ten-person race is a Banger, and every extra ten adds another certification.

## The randomizer in short

Z1R shuffles items, dungeons, caves, shops, enemies and text, then checks the result is beatable: the program simulates the game by walking every reachable room with the current inventory until nothing new appears, and rerolls if the seed fails. The FAQ admits a very small number of seeds might be unbeatable but says it believes every generated game is beatable. A seed is in logic when every item and Triforce piece needed to rescue Zelda can be collected in some order from the items found along the way plus start items. Hints are not part of logic and can mislead.

It is closed source: no public repository exists, and the wiki and the original site offer only a Windows download. The rules are documented in pieces: the Guarantees page, the FAQ, the flag pages and the in-game hint phrases. The wiki lists version 3.6.5.

Main shuffles: Overworld Quest (1st, 2nd, Mixed) and Dungeon Quest (1st, 2nd, Mixed, generated Shapes and random options); cave shuffle; where items sit, including hearts, Triforce pieces, keys and the map and compass; dungeon rooms; shop items and prices; start items and swords; Level 9 entry; and options such as Force Gannon fight, mugger rooms, one-hit KO and Prevent Clipping.

A flag string is a copyable code for every option. The same version, seed and flag string always give the same game. Cosmetic options (Link sprite, tunic colors, music, HUD, Select item swap, recorder tune, reduced flashing) do not change the seed; Print Quest Info does. Race ROM encrypts the data for races, and racers confirm the ROM by posting its 4-item ROM hash.

Rookie Rumble 2026 (speedgaming.org/z1rrr5) used a modified Consternation flagset on version 3.6.4, subject to change: Wood Sword start, 8 bombs, the White Sword replaced by the Book, the Magical Sword at 10 hearts, Level 9 at 8 Triforces and 3 starting hearts. Its flag string is `e2kxDFZQ!9oaB3CJrZ6XlkAuDSBkqONiEiNvPy8`. A beginner set for 3.6.X from PDXRex is `1yAqgZqY2T9MiD3vQIa88SZje7DEDnr!PRhHs!JX`. Its 2026 rules allow screen scrolls, block clips and Up+A, score a stage 1 DNF as the entrants plus 0.5, and send ties within one second to a VOD frame count. Racers must stream, and beginners may join any race except tournament matches.

Where the community races: the Z1R Discord (it hosts the SpeedGaming Weekly Race and Seed of the Week); Triforce Triple Play, casual scheduled races on racetime.gg/z1r and raceroom.z1rracing.com (category z1rr), where season 5 runs 31 August to 19 December 2026, rooms require streaming, last at most 4 hours and have a 15-second start delay, and season 4 presets were RP, Hopla and Consternation. SahasrahBot rolls seeds in racetime rooms with `!race <preset>` or `!flags <string>` and has about 35 Z1R presets.
