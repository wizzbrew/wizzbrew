# Brinstar (`brinstar`): logic rules

Each line is an item location and the rule that must hold, on top of the entry rule of the part of the area it is in. A location is in logic when both hold. C is Casual logic, T is Tournament logic; a line with no tag is the same in both. A rule of "free" adds nothing beyond the entry rule.

## Entry rule

Blue: always open. Green: DBW or Spd. Pink: (RED and (DBW or Spd)) or PB. Red: BASE. Kraid's lair: (DBW or Spd) and Super and PASS.

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

- Morphing Ball: free
- Power Bomb (blue Brinstar), Missile (blue Brinstar top), Missile (blue Brinstar behind missile): PB
- Missile (blue Brinstar middle), Missile (blue Brinstar bottom): Morph
- Energy Tank, Brinstar Ceiling: C: FLY or HJ or Spd or Ice. T: free
- Power Bomb (green Brinstar bottom), Energy Tank (Etecoons): PB
- Missile (green Brinstar below super missile): RED
- Super Missile (green Brinstar top), Reserve Tank (Brinstar): C: RED and Spd. T: RED and (Morph or Spd)
- Missile (green Brinstar behind missile): C: Spd and PASS and RED. T: (PASS or (Morph and Screw)) and RED
- Missile (green Brinstar behind reserve tank): C: Spd and RED and Morph. T: RED and Morph
- Super Missile (green Brinstar bottom): PB and Super
- Super Missile (pink Brinstar): PASS and Super
- Missile (pink Brinstar top) and (bottom): free
- Charge Beam: PASS
- Power Bomb (pink Brinstar): C: PB and Super and TANKS(1). T: PB and Super
- Missile (green Brinstar pipe): Morph and (Power Bomb pack or Super)
- Energy Tank, Waterway: PB and RED and Spd and (TANKS(1) or Gr)
- Energy Tank, Brinstar Gate: C: PB and Wave and TANKS(1). T: PB and (Wave or Super)
- X-Ray Scope: C: PB and RED and (Grap or SJ). T: PB and RED and (Grap or SJ or ((IBJ or (HJ and Spd) or SBJ) and ((Var and TANKS(3)) or TANKS(5))))
- Power Bomb (red Brinstar sidehopper room), Missile (red Brinstar spike room): PB and Super
- Power Bomb (red Brinstar spike room): C: (PB or Ice) and Super. T: Super
- Spazer: Morph and Super
- Energy Tank (Kraid), Varia Suit: free. Missile (Kraid): PB
