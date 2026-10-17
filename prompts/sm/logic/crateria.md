# Crateria (`crateria`): logic rules

Each line is an item location and the rule that must hold, on top of the entry rule of the part of the area it is in. A location is in logic when both hold. C is Casual logic, T is Tournament logic; a line with no tag is the same in both. A rule of "free" adds nothing beyond the entry rule.

## Entry rule

Central: always open. West: DBW or Spd. East (Wrecked Ship moat side): PB and Super, both logics.

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

- Power Bomb (Crateria surface): PB and (Spd or FLY)
- Missile (Crateria middle): PASS
- Missile (Crateria bottom): DBW
- Super Missile (Crateria): PB and TANKS(2) and Spd
- Bombs (Bomb Torizo): C: PASS and RED. T: Morph and RED
- Energy Tank, Terminator: free
- Energy Tank, Gauntlet: C: GAUNTLET and TANKS(1). T: GAUNTLET
- Missile (Crateria gauntlet right) and (left): C: GAUNTLET and PASS and TANKS(2). T: GAUNTLET and PASS
- GAUNTLET, C: Morph and (FLY or Spd) and (IBJ or (PB and 2 PB) or Screw). T: (Morph and (Bombs or 2 PB)) or Screw or (Spd and PB and TANKS(2))
- Missile (outside Wrecked Ship bottom): C: WSX. T: free
- Missile (outside Wrecked Ship top) and (middle): C: Super and PASS and WSX. T: Super and PASS
- Missile (Crateria moat): free
