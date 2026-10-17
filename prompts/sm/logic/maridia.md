# Maridia (`maridia`): logic rules

Each line is an item location and the rule that must hold, on top of the entry rule of the part of the area it is in. A location is in logic when both hold. C is Casual logic, T is Tournament logic; a line with no tag is the same in both. A rule of "free" adds nothing beyond the entry rule.

## Entry rule

Both parts need the Upper Norfair West entry and PB. Outer: C: Gr. T: Gr or (HJ and (SBJ or Ice)). Inner: C: Gr and (FLY or Spd or Grap). T: Gr or (HJ and (Ice or SBJ) and Grap), so suitless Maridia is Tournament only.

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

- Missile (green Maridia shinespark): C: Spd. T: Gr and Spd
- Super Missile (green Maridia), Missile (green Maridia tatori): free
- Energy Tank, Mama turtle: C: FLY or Spd or Grap. T: FLY or Spd or Grap or (SBJ and (Gr or HJ))
- Super Missile (yellow Maridia), Missile (yellow Maridia super missile), Missile (yellow Maridia false wall): C: PASS. T: PASS and (Gr or Ice or (HJ and SBJ))
- Missile (left Maridia sand pit room), Reserve Tank (Maridia): C: PASS. T: (HJ and (SJ or SBJ)) or Gr
- Missile (right Maridia sand pit room): C: free. T: HJ or Gr
- Power Bomb (right Maridia sand pit room): C: free. T: (HJ and SBJ) or Gr
- Missile (pink Maridia), Super Missile (pink Maridia): C: Spd. T: Gr
- Spring Ball: C: Grap and PB and (SJ or HJ). T: Grap and PB and ((Gr and (FLY or HJ)) or (Ice and HJ and SBJ and SJ))
- Plasma Beam: C: DRAY and (Screw or Plasma) and (HJ or FLY). T: DRAY and (Screw or Plasma or Spd or (Charge and TANKS(3))) and (HJ or SBJ or FLY or Spd)
- Missile (Draygon): C: BOT. T: BOT and Gr
- Energy Tank, Botwoon: BOT and (Gr or Ice)
- Space Jump: C: DRAY. T: DRAY and (FLY or (Spd and HJ))
