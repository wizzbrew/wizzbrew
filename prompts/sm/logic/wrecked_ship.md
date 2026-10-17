# Wrecked Ship (`wrecked_ship`): logic rules

Each line is an item location and the rule that must hold, on top of the entry rule of the part of the area it is in. A location is in logic when both hold. C is Casual logic, T is Tournament logic; a line with no tag is the same in both. A rule of "free" adds nothing beyond the entry rule.

## Entry rule

C: Super and PB and WSX. T: Super and PB.

## Legend

Item shorthand: Spd Speed Booster, HJ Hi-Jump, SJ Space Jump, Grap Grapple, Var Varia, Gr Gravity, Spring Spring Ball. Counts like "2 PB" mean two Power Bomb packs.

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

## Location rules

- Missile (Wrecked Ship middle), Missile (Wrecked Ship top), Super Missile (Wrecked Ship left), Right Super (Wrecked Ship, a major-class location): free
- Reserve Tank, Wrecked Ship: C: Spd and PB and (Grap or SJ or (Var and TANKS(2)) or TANKS(3)). T: PB and Spd and (Var or TANKS(2))
- Gravity Suit, Missile (Gravity Suit): C: Grap or SJ or (Var and TANKS(2)) or TANKS(3). T: Var or TANKS(1)
- Energy Tank, Wrecked Ship: C: HJ or SJ or Spd or Gr. T: Bombs or Power Bomb pack or SBJ or HJ or SJ or Spd or Gr
