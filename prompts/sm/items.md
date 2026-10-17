# Items and upgrades

Beams stack unless noted; Spazer and Plasma cannot be used together (all other combinations can). Shorthand in the logic column: PB is Morph Ball and a Power Bomb pack, PASS is Morph and (Bombs or a Power Bomb pack), DBW is PASS or Screw Attack, RED is Missile or Super Missile, IBJ is infinite bomb jump (Morph and Bombs), FLY is Space Jump or IBJ, SBJ is Spring Ball jump (Morph and Spring Ball), HELL is Varia or 5 tanks, TANKS(n) is n Energy plus Reserve Tanks, BOT and DRAY are the Botwoon and Draygon rules, BASE is (DBW or Speed) and Super and Morph. C is Casual logic, T is Tournament logic.

## The item list

| Item | What it does | Practical note | In logic it provides |
|---|---|---|---|
| Power Beam | Starting weapon | Always on; base of all beam combos | |
| Charge Beam | Hold fire for a charged shot | Pairs with Ice, Wave, Spazer and Plasma; strong damage per shot | Gold Torizo Super Missile alternative, Plasma alternative, Lower Norfair east traversal (T, with Ice) |
| Ice Beam | Freezes enemies into platforms | Ice, Wave and Plasma charged together is a common boss combo | Freezing for platforms and BOT (T), Maridia Outer or Inner entry (T), several Norfair spots |
| Wave Beam | Shots pass through walls | Casual logic uses it for Pink Brinstar and Crocomire rules | Pink Brinstar gate tank (C needs it; T accepts Wave or Super), Crocomire entry (C) |
| Spazer | Wider triple shot | Never required by the randomizer logic | Nothing; never referenced by any rule |
| Plasma Beam | Piercing shot | Cannot be equipped with Spazer (swap on the pause screen) | Plasma Beam room clear (with or instead of Screw) |
| Varia Suit | Heat protection, halves damage | Required for survivable Norfair heat in Casual logic | Heat: Upper East entry (C), Lower Norfair, some Ice Beam rules (T alternative: 3 tanks) |
| Gravity Suit | Free movement in liquid, extra damage reduction | In the vanilla game it also covers heat; the randomizer ROM removes that | Maridia, Lower Norfair, Wrecked Ship moat (C); does NOT protect from heat in this ROM |
| Hi-Jump Boots | Jump higher | Makes some wall jumps unnecessary | Height rules, Tournament suitless Maridia, Lower Norfair alternative to Gravity |
| Space Jump | Infinite spin jumps in mid-air | Lets you fly; replaces Hi-Jump and bomb jumps in most places | FLY, Grapple or X-Ray alternatives, Lower Norfair (C needs it) |
| Speed Booster | Run fast to flash blue, break blocks, charge a Shinespark | Needed for speed puzzles and many shortcuts | Alternative to bomb walls at the start (DBW or Spd), shinesparks, BOT, Ice Beam (C) |
| Morph Ball | Roll into a ball for small tunnels | Nearly everything needs it | Prerequisite for PB, PASS, IBJ, SBJ; nearly everything needs it |
| Bombs | Lay bombs; bomb jump | Infinite bomb jump (IBJ) lets you climb forever | PASS, IBJ (so FLY); Tournament Wrecked Ship energy tank |
| Spring Ball | Bounce in ball form | Enables the Spring Ball jump (Tournament logic) | SBJ (Tournament only) |
| Screw Attack | Spin jump is damaging, destroys blocks | Kills most things; skips bomb walls | DBW, Gauntlet alternative, Plasma room, Lower Norfair east alternative |
| Grappling Beam | Swing from grapple blocks and pull things | Also the Draygon electric kill | Crocomire-side and Maridia crossings, X-Ray route, Spring Ball location |
| X-Ray Scope | See through hidden blocks | Never required by logic; powers the X-Ray climb glitch | Nothing; never referenced by any rule |
| Missiles | Basic ammo, opens red doors | Super does 300 damage (speedrun wiki, Golden Torizo note); Missile 100 | RED |
| Super Missiles | Open green doors, stronger | Many bosses fall quickly to Supers | RED; Super also opens Crateria east, Red Brinstar, Kraid, Norfair, Wrecked Ship and the BASE rule |
| Power Bombs | Screen-wide blast, opens yellow doors | Also needed for Crystal Flash | PB, PASS; Casual gauntlet and Tournament gauntlet want 2 |
| Energy Tank, Reserve Tank | +100 max energy each | Reserves drain automatically when you hit zero, or on demand from the pause screen | TANKS(n) and HELL; 14 Energy plus 4 Reserve in the game, 4 Energy in the logic pool |
| Hyper Beam | Unlimited rapid fire, kills Mother Brain | Only in the final fight; a gift from the baby | |

## Tank and ammo totals

14 Energy Tanks (+100 each, 1499 max with the starting 99), 4 Reserve Tanks (+100 each, 400 total), 46 Missile packs (+5, 230 max), 10 Super Missile packs (+5, 50 max) and 10 Power Bomb packs (+5, 50 max). That is 84 tank and ammo locations, plus 16 unique items, for 100 item locations.

## Placement rules

Only the 22 progression items (Morph, Bombs, Ice, Hi-Jump, Speed, Screw, Varia, Gravity, Grapple, Space Jump, Spring Ball, Wave, Plasma, Charge, 1 Missile pack, 1 Super pack, 2 Power Bomb packs, 4 Energy Tanks) are placed by logic. Spazer, X-Ray, the other 10 Energy Tanks, all 4 Reserve Tanks and the other 62 ammo packs are dropped in afterward with no logic. So the generator never relies on more than 4 tanks, which makes "5 tanks" alternatives (HELL via tanks, 5-tank X-Ray) unreachable as generator guarantees; a player who already holds extra tanks may still use them.

Pool: 14 majors listed above, 4 progression Energy Tanks, Spazer, X-Ray, 10 more Energy Tanks, 4 Reserve Tanks; minors are 1 Missile, 1 Super, 2 Power Bomb progression packs plus 62 random packs.

The first placements are forced reachable: Morph, a Missile or Super, and one bomb-breaker (Screw, Speed or Bombs at 1/8 each, else Power Bomb); with split placement Super and Power Bomb are also forced early, and with Casual plus split the breaker is always a Power Bomb.

Placement bans: Gravity not in Crateria or Brinstar except X-Ray Scope or Energy Tank (Waterway); Varia, Speed and Screw never at Morphing Ball, Missile (blue Brinstar middle) or Energy Tank (Brinstar Ceiling); Varia is also barred from Crateria. (A Lower Norfair ban on Varia uses a mismatched area string in the code and is inert, but Lower Norfair needs Varia to enter anyway.)

Defaults: Tournament logic, Major/Minor split placement (34 major locations hold only majors: suits, beams, boots, tanks, Reserve, Morph, Bombs and so on; the 66 minor locations hold ammo packs; the other choice is Full randomization), goal defeat Mother Brain. Modes: single player or multiworld; a Keysanity flag exists in the config but is not exposed as an option and no rule uses it.

## Base game changes that affect logic

From the ROM patch sources (sm_randomizer_rom): intro and Ceres skipped, start on Zebes; Gravity Suit no longer protects from heat; suit pickup animations removed; the construction zone door and the Red Tower elevator door are blue; the Hi-Jump Energy Tank became a minor-class location and Right Super in the Wrecked Ship a major-class one; Space/Time beam and the GT code disabled; a door ASM near the construction zone sets Zebes awake; the Golden 4 statue room opens once the four main bosses are dead. Patches also include Early Super bridge, moat, Nova Boost platform, Red Tower and Spazer room fixes.
