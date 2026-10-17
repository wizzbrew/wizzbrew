#!/usr/bin/env python3
"""Export the static key logic table of the ALttP door randomizer as JSON.

Usage:
    python3 tools/export-key-logic.py PATH/TO/source/dungeon/StaticKeyLogic.py [OUTPUT.json]

The module is parsed with `ast` and never imported, so nothing from the randomizer runs. The
output defaults to prompts/alttp/logic/keys.json next to this repository.

What is exported:
  * dungeons: DOOR_RULES keyed by the short dungeon code (hc, ep, dp, toh, ct, pod, sp, sw, tt,
    ip, mm, tr, gt). Each dungeon maps a key door name to either a number (small keys needed) or
    a conditional object. The conditional objects are copied as written: `keys` is the number of
    small keys, `small_key_in` / `big_key_in` name the chest or chests, and `with_small_key` /
    `with_big_key` give the lower count that applies when that key sits there.
  * constants: every other top-level assignment whose value is a plain literal (the location
    name lists the table refers to).

What is NOT exported: the function-based cases in set_static_key_rules and set_turtle_rock_rules
(the Ganon's Tower chest rules, the Turtle Rock entrance dependent counts, and the forbidden key
placements). They are code, not data, so they stay in the randomizer.

Python 3, standard library only.
"""
import ast
import json
import os
import sys

TABLE_NAME = "DOOR_RULES"

# The randomizer's dungeon names, as they appear as DOOR_RULES keys, mapped to the short codes
# the bot uses. An unknown dungeon name stops the export rather than being guessed.
DUNGEON_CODES = {
    "Hyrule Castle": "hc",
    "Eastern Palace": "ep",
    "Desert Palace": "dp",
    "Tower of Hera": "toh",
    "Agahnims Tower": "ct",
    "Palace of Darkness": "pod",
    "Swamp Palace": "sp",
    "Skull Woods": "sw",
    "Thieves Town": "tt",
    "Ice Palace": "ip",
    "Misery Mire": "mm",
    "Turtle Rock": "tr",
    "Ganons Tower": "gt",
}


def literal(node, what):
    try:
        return ast.literal_eval(node)
    except (ValueError, SyntaxError) as err:
        raise SystemExit("cannot read %s as a literal: %s" % (what, err))


def export(source_path):
    with open(source_path, encoding="utf-8") as handle:
        tree = ast.parse(handle.read(), filename=source_path)

    table = None
    constants = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not isinstance(target, ast.Name):
            continue
        if target.id == TABLE_NAME:
            table = literal(node.value, TABLE_NAME)
            continue
        try:
            constants[target.id] = ast.literal_eval(node.value)
        except (ValueError, SyntaxError):
            continue  # not plain data, so not a constant to export

    if not isinstance(table, dict):
        raise SystemExit("no top-level %s dictionary found in %s" % (TABLE_NAME, source_path))

    dungeons = {}
    for name, doors in table.items():
        if name not in DUNGEON_CODES:
            raise SystemExit("unknown dungeon name in %s: %r" % (TABLE_NAME, name))
        if not isinstance(doors, dict):
            raise SystemExit("dungeon %r is not a dictionary of doors" % name)
        for door, rule in doors.items():
            if isinstance(rule, bool) or not isinstance(rule, (int, dict)):
                raise SystemExit("door %r in %r has an unsupported rule: %r" % (door, name, rule))
        dungeons[DUNGEON_CODES[name]] = doors

    return {"source": os.path.basename(source_path), "dungeons": dungeons, "constants": constants}


def main(argv):
    if len(argv) not in (2, 3):
        raise SystemExit(__doc__)
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.join(here, "..", "prompts", "alttp", "logic", "keys.json")
    out_path = os.path.normpath(argv[2] if len(argv) == 3 else default_out)
    data = export(argv[1])
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print("wrote %s (%d dungeons, %d constants)" % (out_path, len(data["dungeons"]), len(data["constants"])))


if __name__ == "__main__":
    main(sys.argv)
