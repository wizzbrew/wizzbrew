# Zebes: how each area is entered, the logic terms and the techniques

## How to read the rules

A location is in logic when both hold for the items collected so far: its region's entry rule (`CanEnter`) and the location's own rule. The code has 16 regions; each location's requirement is added on top of its region's entry. The rules check access to rooms and items, not the fight itself: no boss kill is modeled, and no ammo or energy count is checked except through the tank rules below.

C means Casual logic, T means Tournament logic. A line with no tag is identical in both. Item shorthand: Spd Speed Booster, HJ Hi-Jump, SJ Space Jump, Grap Grapple, Var Varia, Gr Gravity, Spring Spring Ball. Counts like "2 PB" mean two Power Bomb packs.

### Predicates (names as in the code, shorthand used below)

| Shorthand | Code name | Satisfied by |
|---|---|---|
| PB | CanUsePowerBombs | Morph Ball and a Power Bomb pack |
| PASS | CanPassBombPassages | Morph and (Bombs or a Power Bomb pack) |
| DBW | CanDestroyBombWalls | PASS or Screw Attack |
| RED | CanOpenRedDoors | Missile or Super Missile |
| IBJ | CanIbj | Morph and Bombs (infinite bomb jump) |
| FLY | CanFly | Space Jump or IBJ |
| SBJ | CanSpringBallJump | Morph and Spring Ball |
| HELL | CanHellRun | Varia or 5 tanks (Energy plus Reserve) |
| TANKS(n) | HasEnergyReserves | at least n Energy plus Reserve Tanks |
| BOT | CanDefeatBotwoon | C: Speed Booster. T: Ice, or Speed and Gravity |
| DRAY | CanDefeatDraygon | C: Speed and Gravity and (Hi-Jump or FLY). T: BOT and Gravity |
| BASE | (inline, repeated) | (DBW or Speed) and Super and Morph |
| WSX | (inline, Casual only) | Space Jump or Speed or Grapple or (Gravity and (FLY or Hi-Jump)) |

## Areas and how they are entered

Crateria is the surface around the gunship and connects to every other area; the Wrecked Ship sits off to the east in the moat.

- **Crateria** (`crateria`). Central: always open. West: DBW or Spd. East (Wrecked Ship moat side): PB and Super, both logics.
- **Brinstar** (`brinstar`). Blue: always open. Green: DBW or Spd. Pink: (RED and (DBW or Spd)) or PB. Red: BASE. Kraid's lair: (DBW or Spd) and Super and PASS.
- **Upper Norfair** (`norfair_upper`). West (Ice Beam and Hi-Jump side, no heat rule at entry): BASE. East (bubble Norfair, Speed Booster, Wave): C: BASE and Var. T: BASE and HELL (the extra "Super or (Spd and PB)" is redundant since BASE already holds Super). Crocomire: C: BASE and Var and (PB and Spd, or Spd and Wave, or Morph and (FLY or HJ) and Wave). T: BASE and (TANKS(2) and Spd, or HELL) and (FLY or HJ or SBJ or (Var and Ice) or Spd) and (PASS or Spd or (Var and Morph)).
- **Lower Norfair** (`norfair_lower`). Both halves need Var and the Upper East entry and PB. West: C: plus SJ and Gr. T: plus (HJ or Gr). East: C: same as C West. T: West's rule plus (FLY or HJ or SBJ or (Ice and Charge)) and (PASS or (Screw and SJ)) and (Morph or TANKS(5)).
- **Wrecked Ship** (`wrecked_ship`). C: Super and PB and WSX. T: Super and PB.
- **Maridia** (`maridia`). Both parts need the Upper Norfair West entry and PB. Outer: C: Gr. T: Gr or (HJ and (SBJ or Ice)). Inner: C: Gr and (FLY or Spd or Grap). T: Gr or (HJ and (Ice or SBJ) and Grap), so suitless Maridia is Tournament only.
- **Tourian** (`tourian`). Not modeled: no item locations, no entry rule. The ROM patch opens the path to it once Kraid, Phantoon, Draygon and Ridley are dead.

The randomizer ROM removes the Gravity Suit's heat protection, so Gravity does not cover Norfair heat.

## Techniques

What each costs or does, and whether the logic uses it. "Not referenced" means no rule names it; players may still use it, the logic just never requires it. Speed echoes are also not referenced.

| Technique | Plain description | Casual logic | Tournament logic |
|---|---|---|---|
| Infinite bomb jump (IBJ) | Chain bombs forever to climb as high as you want (needs Morph and Bombs) | yes (counts as FLY) | yes |
| Bomb jump | Lay a bomb under you to launch yourself upward, slow but flexible | not covered by the logic notes | not covered by the logic notes |
| Spring Ball jump | Spring Ball hop mid-air to cross gaps | no | yes |
| Hell run | Cross a hot zone without Varia, usually by spending energy tanks (VARIA has hell run tiers); the HELL predicate is Varia or 5 tanks | no (Varia required for Norfair heat) | yes |
| Suitless Maridia | Navigate Maridia without Gravity using Hi-Jump, Ice, Spring Ball and Grapple (Grapple inside) | no | yes |
| Hi-Jump in place of Gravity in Lower Norfair | Hi-Jump Boots stand in for the Gravity Suit when entering Lower Norfair | no | yes |
| Speed Booster and shinespark spots | Run to flash blue and spark; used at the Crateria Super Missile, Waterway and the green Maridia shinespark | yes | yes |
| Gauntlet with Speed, PB and 2 tanks | A route through the Crateria gauntlet using Speed Booster, a Power Bomb and 2 tanks | no | yes |
| Ice as a height or platform alternative | Freeze enemies into platforms | limited | yes, more widely |
| Screw Attack plus Space Jump through Lower Norfair east | Screw Attack and Space Jump used to get through that half | no | yes |
| Energy tank buffers in rooms | Small energy requirements, TANKS(1) to TANKS(3) | yes | fewer |
| Mockball | Morph mid-run without losing running speed; used to reach the Early Supers room | not referenced | not referenced |
| Short charge | Tap dash with timing (or stutter-step) to build Speed Booster charge over a shorter distance | not referenced | not referenced |
| Wall jump | Kick off a wall mid-spin to regain height; repeated between two close walls it climbs a shaft | not referenced | not referenced |
| Crystal Flash | Lay a Power Bomb with specific inputs to refill energy and Reserves; costs 10 Missiles, 10 Supers and 10 or 11 Power Bombs, and needs 50 or less energy with empty Reserves | not referenced | not referenced |
| Gravity jump | Pause mid-jump, take off the Gravity Suit, resume to jump very high in water | not referenced | not referenced |
| X-Ray climb | Crouch with X-Ray and turn around to slide upward, passing through ceilings (also called the door glitch) | not covered by the logic notes | not covered by the logic notes |
| Door transitions | Moving through a door at speed or an odd position to skip or shift rooms | not covered by the logic notes | not covered by the logic notes |

Glitches by name only (speedrun wiki, SDA, VARIA): moonwalk, moonfall, damage boosting, Alcatraz Escape, Ocean Fly, Halfie, Lava Spark, Metroid Skip, Zebetite Glitch, Crouch Lock, bounceball, Yellow Suit Glitch, Blue Suit Glitch, green gate glitch, Murder Beam, Space/Time Beam, chainsaw beam, Mochtroid, Puyo, Snail and Crystal Flash clips, Ice and Speed Zeb Skip, corner jump, kagoball, waterball, springball lock.
