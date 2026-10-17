# Upper Norfair (`norfair_upper`): logic rules

Each line is an item location and the rule that must hold, on top of the entry rule of the part of the area it is in. A location is in logic when both hold. C is Casual logic, T is Tournament logic; a line with no tag is the same in both. A rule of "free" adds nothing beyond the entry rule.

## Entry rule

West (Ice Beam and Hi-Jump side, no heat rule at entry): BASE. East (bubble Norfair, Speed Booster, Wave): C: BASE and Var. T: BASE and HELL (the extra "Super or (Spd and PB)" is redundant since BASE already holds Super). Crocomire: C: BASE and Var and (PB and Spd, or Spd and Wave, or Morph and (FLY or HJ) and Wave). T: BASE and (TANKS(2) and Spd, or HELL) and (FLY or HJ or SBJ or (Var and Ice) or Spd) and (PASS or Spd or (Var and Morph)).

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

- Ice Beam: C: Super and PASS and Var and Spd. T: Super and Morph and (Var or TANKS(3))
- Missile (below Ice Beam): C: Super and PB and Var and Spd. T: (Super and PB and (Var or TANKS(3))) or (Var and Spd and Super)
- Hi-Jump Boots: RED and PASS
- Missile (Hi-Jump Boots), Energy Tank (Hi-Jump Boots, a minor-class location): RED
- Missile (lava room): Morph
- Reserve Tank (Norfair), Missile (Norfair Reserve Tank): C: Morph and (FLY or (Grap and (Spd or PASS)) or HJ or Ice). T: Morph and Super
- Missile (bubble Norfair green door): C: FLY or (Grap and Morph and (Spd or PASS)) or HJ or Ice. T: Super
- Missile (bubble Norfair): free
- Missile (Speed Booster), Speed Booster: C: FLY or (Morph and (Spd or PASS)) or HJ or Ice. T: Super
- Missile (Wave Beam): C: same as Speed Booster. T: free
- Wave Beam: C: Morph and (FLY or (Spd or PASS) or HJ or Ice). T: RED and (Morph or Grap or (HJ and Var) or SJ)
- Energy Tank (Crocomire): C: TANKS(1) or SJ or Grap. T: free
- Missile (above Crocomire): C: FLY or Grap or (HJ and Spd). T: (FLY or Grap or (HJ and (Spd or SBJ or (Var and Ice)))) and HELL
- Power Bomb (Crocomire): C: FLY or HJ or Grap. T: free
- Missile (below Crocomire): Morph
- Missile (Grappling Beam): C: Morph and (FLY or (Spd and PB)). T: Spd or (Morph and (FLY or Grap))
- Grappling Beam: C: Morph and (FLY or (Spd and PB)). T: SJ or Morph or Grap or (HJ and Spd)
