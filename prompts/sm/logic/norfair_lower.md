# Lower Norfair (`norfair_lower`): logic rules

Each line is an item location and the rule that must hold, on top of the entry rule of the part of the area it is in. A location is in logic when both hold. C is Casual logic, T is Tournament logic; a line with no tag is the same in both. A rule of "free" adds nothing beyond the entry rule.

## Entry rule

Both halves need Var and the Upper East entry and PB. West: C: plus SJ and Gr. T: plus (HJ or Gr). East: C: same as C West. T: West's rule plus (FLY or HJ or SBJ or (Ice and Charge)) and (PASS or (Screw and SJ)) and (Morph or TANKS(5)).

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

- Missile (Gold Torizo): C: PB, SJ, Super. T: PB, SJ, Var and (HJ or Gr). These two rules are on Lower Norfair West; the fight itself is not modeled.
- Super Missile (Gold Torizo): C: DBW, (Super or Charge), SJ, PB. T: DBW, Var and (Super or Charge)
- Screw Attack: C: DBW and SJ and PB. T: DBW and Var
- Missile (Mickey Mouse room), Missile (lower Norfair near Wave Beam): C: free. T: Morph and DBW
- Missile (lower Norfair above fire flea room), Energy Tank (Firefleas): free
- Power Bomb (lower Norfair above fire flea room): C: free. T: PASS
- Power Bomb (Power Bombs of shame): PB
- Energy Tank, Ridley: PB and Super
