#!/usr/bin/env python3
"""Export the per-location dungeon logic of the ALttP door randomizer as JSON.

Usage:
    PY=path/to/ALttPDoorRandomizer/.venv/bin/python
    $PY -B tools/export-dungeon-logic.py path/to/ALttPDoorRandomizer noglitches
    $PY -B tools/export-dungeon-logic.py path/to/ALttPDoorRandomizer hybridglitches
    $PY -B tools/export-dungeon-logic.py path/to/ALttPDoorRandomizer noglitches --check

The first form writes prompts/alttp/logic/requirements.json, the second (Hybrid Major Glitches)
writes prompts/alttp/logic/requirements-hmg.json; a third argument names another output file.
`--check` writes nothing: it builds the world and fails unless the full inventory reaches every
dungeon location, so an engine change that breaks the export is caught by running it.

Unlike tools/export-key-logic.py, this script imports and runs the randomizer's own code, so the
rules and the static key layer are evaluated together by the real engine. It needs a Python with
the randomizer's requirements (its pip_requirements.txt; its own venv works). The script itself
uses the standard library only. Nothing is written inside the checkout: the world is built in
memory (vanilla doors and entrances, no ROM, no spoiler) and bytecode writing is turned off.

Method, for every location whose region belongs to a dungeon (chests, big chests, boss drops,
prizes, key drops and pot keys; the puzzle events such as switches are skipped):
  * The full inventory is one of every progression item, every copy of the progressive ones and
    the bottles, all crystals and pendants, and each dungeon's small keys (chest keys, the count
    the static key logic reads) and big key. The Agahnim fights stay events, so beating Agahnim
    is earned in the world. Every dungeon location must be reachable with it.
  * Units are the removable items: each progression item, with a progressive family (Sword,
    Glove, Bow, Shield) or the bottles taken as one unit. Crystals, pendants and starting items
    (the boots, under Hybrid Major Glitches) are always held. A literal is a unit at a level:
    taking (Sword, 2) away leaves the Fighter Sword.
  * A cut is a set of literals whose removal breaks reach. Every single literal, pair and triple
    is tested, plus the predefined groups below (melee, fire, weapon, rods, canes), each shrunk
    to a minimal cut with its levels raised as far as they still cut. One sweep takes a few
    milliseconds, so this is exhaustive over all units instead of a candidate list read from
    rule source. Then the search is closed: every smallest item set that meets all known cuts is
    tried alone, and one that fails proves a missing cut, which is shrunk and added, until every
    such set holds. The cuts are then the whole rule: a cut of one literal is a need, a larger one
    an any-of group, and only cuts no other cut implies are kept.
  * Groups that share items are also written as alternatives (either), the item sets that meet
    them all, when that reads shorter; a whole component is checked against the engine.
  * Keys: with everything else present, the fewest small keys that keep the location reachable,
    whether the big key is needed (a big key that drops from an enemy is taken away too), and the
    higher small key count that applies when one unit is missing (small_keys_without).
  * Entry: the same analysis for reaching any of the dungeon's entry regions (regions entered
    from outside the dungeon). A location's needs and groups that entry already implies are
    dropped, so each location lists only what it needs beyond getting in.
"""
import itertools
import json
import os
import sys
import time

sys.dont_write_bytecode = True

DUNGEON_CODES = {
    "Hyrule Castle": "hc",
    "Agahnims Tower": "ct",
    "Eastern Palace": "ep",
    "Desert Palace": "dp",
    "Tower of Hera": "toh",
    "Palace of Darkness": "pod",
    "Swamp Palace": "sp",
    "Skull Woods": "sw",
    "Thieves Town": "tt",
    "Ice Palace": "ip",
    "Misery Mire": "mm",
    "Turtle Rock": "tr",
    "Ganons Tower": "gt",
}

LOGICS = {"noglitches": "requirements.json", "hybridglitches": "requirements-hmg.json"}

# Progressive items are removed and leveled as one family; the bottles are one unit, never leveled.
FAMILIES = {
    "Progressive Sword": "Sword",
    "Progressive Glove": "Glove",
    "Progressive Bow": "Bow",
    "Progressive Shield": "Shield",
    "Progressive Armor": "Mail",
}
LEVELED = {"Sword", "Glove", "Bow", "Shield", "Mail"}
BOTTLE = "Bottle"
# The pool fills bottles at random, and the engine counts distinct bottle names (bottle_count), so
# every bottle in the pool is held under its own name from this list. That keeps the export the
# same from run to run and counts each bottle the pool has.
BOTTLE_NAMES = ["Bottle", "Bottle (Red Potion)", "Bottle (Green Potion)", "Bottle (Blue Potion)",
                "Bottle (Fairy)", "Bottle (Bee)", "Bottle (Good Bee)"]

# Alternative-prone groups whose removal as a whole is tested. Bombs have no unit here: with the
# bomb bag off they are always usable, so they never appear in a cut.
GROUPS = [
    ["Sword", "Hammer"],
    ["Lamp", "Fire Rod"],
    ["Sword", "Hammer", "Bow", "Cane of Somaria", "Cane of Byrna", "Fire Rod", "Ice Rod"],
    ["Fire Rod", "Ice Rod"],
    ["Cane of Somaria", "Cane of Byrna"],
]

AGAHNIM_EVENTS = {"Agahnim 1": "Beat Agahnim 1", "Agahnim 2": "Beat Agahnim 2"}
SETTINGS_ARGS = [
    "--mode", "open", "--logic", None, "--swords", "random", "--difficulty", "normal",
    "--item_functionality", "normal", "--shuffle", "vanilla", "--door_shuffle", "vanilla",
    "--intensity", "1", "--key_logic_algorithm", "static", "--pottery", "none",
    "--dropshuffle", "none", "--keyshuffle", "none", "--accessibility", "items", "--goal", "ganon",
    "--suppress_rom", "--spoiler", "none",
]
PLAYER = 1


def git_commit(checkout):
    head_path = os.path.join(checkout, ".git", "HEAD")
    if not os.path.isfile(head_path):
        return None, None
    with open(head_path, encoding="utf-8") as handle:
        head = handle.read().strip()
    if not head.startswith("ref: "):
        return None, head[:12]
    ref = head[5:]
    ref_path = os.path.join(checkout, ".git", ref)
    if os.path.isfile(ref_path):
        with open(ref_path, encoding="utf-8") as handle:
            return ref[len("refs/heads/"):], handle.read().strip()[:12]
    packed = os.path.join(checkout, ".git", "packed-refs")
    if os.path.isfile(packed):
        with open(packed, encoding="utf-8") as handle:
            for line in handle:
                parts = line.split()
                if len(parts) == 2 and parts[1] == ref:
                    return ref[len("refs/heads/"):], parts[0][:12]
    return ref[len("refs/heads/"):], None


def load_engine(checkout):
    checkout = os.path.abspath(checkout)
    if not os.path.isfile(os.path.join(checkout, "source", "dungeon", "StaticKeyLogic.py")):
        raise SystemExit("%s does not look like an ALttPDoorRandomizer checkout with static key logic" % checkout)
    # The engine reads its resources relative to the working directory and asks for a locale.
    os.environ["LC_ALL"] = "en_US.UTF-8"
    os.environ["LANG"] = "en_US.UTF-8"
    os.chdir(checkout)
    sys.path.insert(0, checkout)
    import logging

    logging.disable(logging.CRITICAL)
    return checkout


def build_world(logic):
    """The vanilla world of test/TestBase.py build_vanilla_world, plus the Hybrid Major Glitches
    connections that Main.py adds, built in memory only."""
    from BaseClasses import World
    from CLI import parse_cli
    from DoorShuffle import link_doors, link_doors_prep
    from Doors import create_doors
    from Dungeons import create_dungeons
    from Fill import get_dungeon_item_pool
    from ItemList import difficulties, generate_itempool
    from Items import ItemFactory
    from Main import set_world_options
    from OverworldGlitchRules import create_owg_connections
    from OverworldShuffle import create_dynamic_exits, link_overworld
    from Regions import create_dungeon_regions, create_regions, create_shops, mark_light_dark_world_regions
    from RoomData import create_rooms
    from Rules import set_rules
    from UnderworldGlitchRules import connect_hmg_entrances_regions, create_hmg_entrances_regions
    from source.classes.BabelFish import BabelFish
    from source.enemizer.DamageTables import DamageTable
    from source.item.FillUtil import create_item_pool_config
    from source.overworld.EntranceShuffle2 import link_entrances_new
    from source.rom.DataTables import init_data_tables

    argv = [logic if a is None else a for a in SETTINGS_ARGS]
    args = parse_cli(argv)
    world = World(args.multi, args.shuffle, args.door_shuffle, args.logic, args.mode, args.swords,
                  args.difficulty, args.item_functionality, args.timer, args.progressive, args.goal,
                  args.algorithm, args.accessibility, args.shuffleganon, args.custom, args.customitemarray,
                  args.hints, args.spoiler)
    world.customizer = None
    world.seed = 1
    set_world_options(world, args, BabelFish(lang="en"))
    world.difficulty_requirements[PLAYER] = difficulties[world.difficulty[PLAYER]]
    if world.logic[PLAYER] != logic or world.key_logic_algorithm[PLAYER] != "static":
        raise SystemExit("the engine did not accept logic %s with static key logic" % logic)

    create_regions(world, PLAYER)
    if logic in ("owglitches", "hybridglitches", "nologic"):
        create_owg_connections(world, PLAYER)
    create_dungeon_regions(world, PLAYER)
    create_shops(world, PLAYER)
    create_doors(world, PLAYER)
    create_rooms(world, PLAYER)
    create_dungeons(world, PLAYER)
    world.damage_table[PLAYER] = DamageTable()
    world.data_tables[PLAYER] = init_data_tables(world, PLAYER)

    link_overworld(world, PLAYER)
    create_dynamic_exits(world, PLAYER)
    link_entrances_new(world, PLAYER)
    link_doors_prep(world, PLAYER)
    create_item_pool_config(world)
    link_doors(world, PLAYER)
    mark_light_dark_world_regions(world, PLAYER)
    if logic in ("nologic", "hybridglitches"):
        create_hmg_entrances_regions(world, PLAYER)
        connect_hmg_entrances_regions(world, PLAYER)

    generate_itempool(world, PLAYER)
    world.required_medallions[PLAYER] = ["Ether", "Quake"]
    world.itempool.extend(get_dungeon_item_pool(world))
    prizes = ["Green Pendant", "Red Pendant", "Blue Pendant", "Crystal 1", "Crystal 2", "Crystal 3",
              "Crystal 4", "Crystal 5", "Crystal 6", "Crystal 7"]
    world.itempool.extend(ItemFactory(prizes, PLAYER))
    for name, event in AGAHNIM_EVENTS.items():
        location = world.get_location(name, PLAYER)
        item = ItemFactory(event, PLAYER)
        location.item, item.location, item.world = item, location, world
        location.event = location.locked = True
    set_rules(world, PLAYER)
    return world, args


def settings_of(world, args, logic):
    def value(attr):
        return getattr(world, attr)[PLAYER]

    return {
        "mode": value("mode"),
        "logic": value("logic"),
        "swords": value("swords"),
        "difficulty": value("difficulty"),
        "item_functionality": value("difficulty_adjustments"),
        "key_logic_algorithm": value("key_logic_algorithm"),
        "shopsanity": bool(value("shopsanity")),
        "pottery": value("pottery"),
        "dropshuffle": value("dropshuffle"),
        "door_shuffle": value("doorShuffle"),
        "entrance_shuffle": value("shuffle"),
        "keyshuffle": value("keyshuffle"),
        "bigkeyshuffle": bool(value("bigkeyshuffle")),
        "bombbag": bool(value("bombbag")),
        "accessibility": value("accessibility"),
        "goal": value("goal"),
        "crystals_needed_for_gt": int(value("crystals_needed_for_gt")),
        "starting_items": sorted(i.name for i in world.precollected_items if i.player == PLAYER),
        "misery_mire_medallion": world.required_medallions[PLAYER][0],
        "turtle_rock_medallion": world.required_medallions[PLAYER][1],
        "cli": " ".join(a for a in (logic if a is None else a for a in SETTINGS_ARGS)),
    }


class Model:
    """The world plus the inventory, and one cached sweep per inventory variant."""

    def __init__(self, world):
        from BaseClasses import CollectionState
        from Dungeons import dungeon_bigs, dungeon_keys
        from Items import ItemFactory

        self.world = world
        self.CollectionState = CollectionState
        self.ItemFactory = ItemFactory
        self.units = {}
        self.prizes = []
        pool = [i for i in world.itempool if i.player == PLAYER]
        for item in pool:
            if item.smallkey or item.bigkey or item.map or item.compass:
                continue
            if item.name.startswith("Crystal ") or item.name.endswith(" Pendant"):
                self.prizes.append(item.name)
                continue
            if item.name.startswith("Bottle"):
                bottles = self.units.setdefault(BOTTLE, [])
                if len(bottles) == len(BOTTLE_NAMES):
                    raise SystemExit("more bottles in the pool than distinct bottle names")
                bottles.append(BOTTLE_NAMES[len(bottles)])
                continue
            if not item.advancement or item.name in AGAHNIM_EVENTS.values():
                continue
            unit = FAMILIES.get(item.name, item.name)
            self.units.setdefault(unit, []).append(item.name)
        self.unit_names = sorted(self.units)
        self.small_keys = {}
        self.big_keys = {}
        for dungeon in DUNGEON_CODES:
            self.small_keys[dungeon] = sum(1 for i in pool if i.name == dungeon_keys[dungeon])
            self.big_keys[dungeon] = dungeon_bigs[dungeon]
        self.small_key_names = {d: dungeon_keys[d] for d in DUNGEON_CODES}
        self.pool_big_keys = {d: sum(1 for i in pool if i.name == dungeon_bigs[d]) for d in DUNGEON_CODES}
        # Big keys some dungeons hand out from a drop rather than a chest (the castle's).
        self.held_big_keys = {
            d: [l for l in world.get_locations() if l.item is not None and l.item.name == dungeon_bigs[d]]
            for d in DUNGEON_CODES
        }
        self.locations = []
        for location in world.get_locations():
            region = location.parent_region
            if region is None or region.dungeon is None or location.player != PLAYER:
                continue
            if region.dungeon.name not in DUNGEON_CODES:
                raise SystemExit("unknown dungeon name: %r" % region.dungeon.name)
            item = location.item
            is_event = location.event and item is not None
            if is_event and not (item.smallkey or item.bigkey) and location.name not in AGAHNIM_EVENTS:
                continue  # a puzzle event (switch, drain), not a place an item sits
            self.locations.append(location)
        self.entries = {}
        for dungeon in DUNGEON_CODES:
            regions = [r for r in world.regions if r.dungeon is not None and r.dungeon.name == dungeon]
            entry = [r for r in regions if any(e.parent_region is None or e.parent_region.dungeon is None
                                               or e.parent_region.dungeon.name != dungeon for e in r.entrances)]
            if not entry:
                raise SystemExit("no entry region found for %s" % dungeon)
            self.entries[dungeon] = entry
        self.targets = [("loc", l) for l in self.locations] + [("entry", d) for d in DUNGEON_CODES]
        self.cache = {}
        self.sweeps = 0
        self.sweep_seconds = 0.0

    def max_count(self, unit):
        return len(self.units[unit])

    def inventory(self, over):
        names = []
        for unit in self.unit_names:
            items = self.units[unit]
            names.extend(items[: over.get(unit, len(items))])
        names.extend(self.prizes)
        for dungeon in DUNGEON_CODES:
            key = self.small_key_names[dungeon]
            names.extend([key] * over.get(key, self.small_keys[dungeon]))
            if ("no big key", dungeon) not in over:
                names.extend([self.big_keys[dungeon]] * self.pool_big_keys[dungeon])
        return names

    def reach(self, over=None):
        over = over or {}
        cache_key = tuple(sorted(over.items(), key=repr))
        hit = self.cache.get(cache_key)
        if hit is not None:
            return hit
        started = time.time()
        cleared = []
        for flag in over:
            if isinstance(flag, tuple) and flag[0] == "no big key":
                for location in self.held_big_keys[flag[1]]:
                    cleared.append((location, location.item))
                    location.item = None
        try:
            state = self.CollectionState(self.world)
            for item in self.ItemFactory(self.inventory(over), PLAYER):
                item.advancement = True
                state.collect(item, True)
            state.sweep_for_events()
            reached = set()
            for index, (kind, target) in enumerate(self.targets):
                if kind == "loc":
                    if target.can_reach(state):
                        reached.add(index)
                elif any(region.can_reach(state) for region in self.entries[target]):
                    reached.add(index)
        finally:
            for location, item in cleared:
                location.item = item
        result = frozenset(reached)
        self.cache[cache_key] = result
        self.sweeps += 1
        self.sweep_seconds += time.time() - started
        return result


def dungeon_of(model, index):
    kind, target = model.targets[index]
    return target if kind == "entry" else target.parent_region.dungeon.name


# A literal is (unit, level): "holds the unit at this level or higher". Removing a literal caps the
# unit one below that level, so (Sword, 2) removed leaves the Fighter Sword. A cut is a frozenset of
# literals over distinct units; as a requirement it reads "any of these".
def removal(cut):
    return {unit: level - 1 for unit, level in cut}


def implies(a, b):
    """True when holding cut a's requirement guarantees cut b's: every literal of a has a weaker
    or equal literal of the same unit in b."""
    b_levels = dict(b)
    return all(unit in b_levels and level >= b_levels[unit] for unit, level in a)


def asks_less(a, b):
    """True when holding the items of term b (unit to level) guarantees term a."""
    return all(unit in b and b[unit] >= level for unit, level in a.items())


def transversals(clauses):
    """The smallest terms (unit to level) that meet every clause, by Berge's method."""
    terms = [{}]
    for clause in sorted(clauses, key=len):
        grown = {}
        for term in terms:
            if any(term.get(unit, 0) >= level for unit, level in clause):
                grown[frozenset(term.items())] = term
                continue
            for unit, level in clause:
                bigger = dict(term)
                bigger[unit] = max(bigger.get(unit, 0), level)
                grown[frozenset(bigger.items())] = bigger
        found = list(grown.values())
        terms = [t for t in found if not any(o is not t and asks_less(o, t) for o in found)]
    return terms


def complete(model, i, clauses):
    """Closes the search: every smallest term that meets the known cuts is tried alone (every
    other unit removed). A term that fails proves a missing cut; it is shrunk to a minimal one,
    added, and the terms are rebuilt. When every term holds, the cuts are the whole rule."""
    clauses = list(clauses)
    units = model.unit_names
    while True:
        missing = None
        for term in transversals(clauses):
            over = {u: 0 for u in units if u not in term}
            for unit, level in term.items():
                if unit in LEVELED:
                    over[unit] = level
            if i not in model.reach(over):
                missing = term
                break
        if missing is None:
            return clauses
        cut = [(u, 1) for u in units if u not in missing]
        cut += [(u, lv + 1) for u, lv in missing.items() if u in LEVELED and lv < model.max_count(u)]
        for literal in list(cut):
            trial = [lit for lit in cut if lit != literal]
            if trial and i not in model.reach(removal(trial)):
                cut = trial
        for position, (unit, level) in enumerate(list(cut)):
            if unit not in LEVELED:
                continue
            for higher in range(model.max_count(unit), level, -1):
                trial = list(cut)
                trial[position] = (unit, higher)
                if i not in model.reach(removal(trial)):
                    cut = trial
                    break
        cut = frozenset(cut)
        if any(implies(c, cut) for c in clauses):
            raise SystemExit("the search for %s did not converge" % describe(model, i))
        clauses = [c for c in clauses if not implies(cut, c)] + [cut]


def analyse(model):
    full = model.reach()
    indexes = [i for i in range(len(model.targets)) if i in full]
    literals = []
    for unit in model.unit_names:
        top = model.max_count(unit) if unit in LEVELED else 1
        literals.extend((unit, level) for level in range(1, top + 1))

    cuts = {i: [] for i in indexes}

    def add(i, cut):
        if not any(implies(c, cut) for c in cuts[i]):
            cuts[i].append(cut)

    for size in (1, 2, 3):
        for combo in itertools.combinations(literals, size):
            if len({unit for unit, _ in combo}) < size:
                continue
            result = model.reach(removal(combo))
            cut = frozenset(combo)
            for i in indexes:
                if i not in result:
                    add(i, cut)

    for group in GROUPS:
        present = [(u, 1) for u in group if u in model.units]
        result = model.reach(removal(present))
        for i in indexes:
            if i in result or any(implies(c, present) for c in cuts[i]):
                continue
            cut = list(present)
            for member in list(present):
                trial = [lit for lit in cut if lit != member]
                if trial and i not in model.reach(removal(trial)):
                    cut = trial
            for position, (unit, _) in enumerate(list(cut)):
                if unit not in LEVELED:
                    continue
                for level in range(model.max_count(unit), 1, -1):
                    trial = list(cut)
                    trial[position] = (unit, level)
                    if i not in model.reach(removal(trial)):
                        cut = trial
                        break
            add(i, frozenset(cut))

    for i in indexes:
        found = cuts[i]
        cuts[i] = [c for c in found if not any(d != c and implies(d, c) for d in found)]
        cuts[i] = complete(model, i, cuts[i])

    keys = {}
    for i in indexes:
        dungeon = dungeon_of(model, i)
        key = model.small_key_names[dungeon]
        top = model.small_keys[dungeon]

        def fewest(extra):
            for count in range(0, top + 1):
                over = dict(extra)
                over[key] = count
                if i in model.reach(over):
                    return count
            return None

        base = fewest({})
        without = {}
        if top > 0 and base is not None:
            for unit in model.unit_names:
                if i not in model.reach({unit: 0}):
                    continue
                count = fewest({unit: 0})
                if count is not None and count > base:
                    without[unit] = count
        big = i not in model.reach({("no big key", dungeon): True})
        keys[i] = (base, big, without)
    return full, cuts, keys


def label(unit, level):
    if unit in LEVELED and level > 1:
        return "%s level %d" % (unit, level)
    return unit


def implied_by_entry(cut, entry_cuts):
    return any(implies(e, cut) for e in entry_cuts)


def components(groups):
    """Indexes of the any-of groups that share a unit with another, joined into components."""
    parent = list(range(len(groups)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in itertools.combinations(range(len(groups)), 2):
        if {u for u, _ in groups[a]} & {u for u, _ in groups[b]}:
            parent[find(a)] = find(b)
    joined = {}
    for index in range(len(groups)):
        joined.setdefault(find(index), []).append(index)
    return [sorted(members) for members in joined.values() if len(members) > 1]


def alternatives(model, index, entry_index, groups, members, verify=True):
    """The interlocked any-of groups rewritten as alternatives: the smallest item sets (with
    levels) that meet every one of them, each checked against the engine. None when a check fails."""
    clauses = [dict(groups[m]) for m in members]
    units = sorted({u for clause in clauses for u in clause})
    if len(units) > 10:
        return None
    levels_of = {u: sorted({c[u] for c in clauses if u in c}) for u in units}

    def meets(term):
        return all(any(u in term and term[u] >= lv for u, lv in c.items()) for c in clauses)

    terms = []
    for size in range(1, len(units) + 1):
        for chosen in itertools.combinations(units, size):
            for picked in itertools.product(*(levels_of[u] for u in chosen)):
                term = dict(zip(chosen, picked))
                if meets(term) and not any(asks_less(t, term) for t in terms):
                    terms.append(term)
    terms = [t for t in terms if not any(o is not t and asks_less(o, t) for o in terms)]
    for term in terms if verify else []:
        over = {u: 0 for u in units if u not in term}
        for unit, level in term.items():
            if unit in LEVELED:
                over[unit] = level
        reached = model.reach(over)
        # Checked only when the dungeon can still be entered: these groups come after entry, and
        # a set that also takes away the way in says nothing about them.
        if index not in reached and (entry_index == index or entry_index in reached):
            return None
    out = [sorted(label(u, lv) for u, lv in term.items()) for term in terms]
    return sorted(out, key=lambda t: (len(t), t))


def requirement(model, index, entry_index, cuts, entry_cuts):
    kept = [c for c in cuts if not implied_by_entry(c, entry_cuts)]
    needs = sorted(label(u, lv) for c in kept if len(c) == 1 for u, lv in c)
    groups = sorted((sorted(c) for c in kept if len(c) > 1),
                    key=lambda g: (len(g), [label(u, lv) for u, lv in g]))
    out = {
        "needs": needs,
        "any_of": [sorted(label(u, lv) for u, lv in g) for g in groups],
    }
    either = []
    for members in components(groups):
        either.extend(shortest_blocks(model, index, entry_index, groups, members, out["any_of"]))
    if either:
        out["either"] = sorted(either, key=lambda block: block["groups"])
    return out


def any_of_text(names):
    return "any of " + (" or ".join(names) if len(names) < 3 else ", ".join(names[:-1]) + " or " + names[-1])


def either_text(terms):
    return "either " + ", or ".join(" and ".join(term) for term in terms)


def shortest_blocks(model, index, entry_index, groups, members, any_of):
    """Interlocked groups read badly as a list of any-of groups. Each component is written in the
    shortest of three ways: all of it as alternatives, its small groups (three items or fewer) as
    alternatives with the large ones left as any-of groups, or all of it as any-of groups."""
    def blocks_for(subset, verify=True):
        terms = alternatives(model, index, entry_index, groups, subset, verify)
        if terms is None:
            print("note: alternatives for %s did not check out; kept as any-of groups"
                  % describe(model, index), file=sys.stderr)
            return None
        return {"groups": subset, "terms": terms}

    options = [[]]
    whole = blocks_for(members)
    if whole is not None:
        options.append([whole])
    small = [m for m in members if len(groups[m]) <= 3]
    if len(small) < len(members):
        parts = []
        for sub in components([groups[m] for m in small]):
            # Only a whole component can be checked alone: the large groups left out of a part
            # share its items, so taking items away for the check would break them too.
            block = blocks_for([small[k] for k in sub], verify=False)
            if block is not None:
                parts.append(block)
        if parts:
            options.append(parts)

    # Alternatives read more easily than the same rule as overlapping groups, so they win unless
    # they run half as long again.
    def cost(blocks):
        covered = {g for block in blocks for g in block["groups"]}
        alternatives_length = sum(len(either_text(block["terms"])) for block in blocks)
        groups_length = sum(len(any_of_text(any_of[m])) for m in members if m not in covered)
        return alternatives_length + 1.5 * groups_length

    return min(options, key=cost)


def describe(model, index):
    kind, target = model.targets[index]
    return target.name if kind == "loc" else "entry of %s" % target


def export(checkout, logic):
    started = time.time()
    checkout = load_engine(checkout)
    world, args = build_world(logic)
    model = Model(world)
    built = time.time()
    model.reach()
    first_sweep = model.sweep_seconds
    full, cuts, keys = analyse(model)

    dungeons = {}
    entry_cuts = {}
    for dungeon, code in DUNGEON_CODES.items():
        index = model.targets.index(("entry", dungeon))
        if index not in full:
            raise SystemExit("the full inventory cannot enter %s" % dungeon)
        entry_cuts[dungeon] = cuts[index]
        dungeons[code] = {
            "entry": requirement(model, index, index, cuts[index], []),
            "locations": [],
            "unreachable": [],
        }
    for index, (kind, location) in enumerate(model.targets):
        if kind != "loc":
            continue
        dungeon = location.parent_region.dungeon.name
        record = dungeons[DUNGEON_CODES[dungeon]]
        if index not in full:
            record["unreachable"].append(location.name)
            continue
        small, big, without = keys[index]
        row = {"name": location.name, "region": location.parent_region.name}
        row.update(requirement(model, index, model.targets.index(("entry", dungeon)), cuts[index],
                               entry_cuts[dungeon]))
        row["small_keys"] = small
        row["big_key"] = big
        if without:
            row["small_keys_without"] = {u: without[u] for u in sorted(without)}
        record["locations"].append(row)

    branch, commit = git_commit(checkout)
    from Main import __version__

    source = "ALttPDoorRandomizer %s" % __version__
    if branch:
        source += ", branch %s" % branch
    if commit:
        source += ", commit %s" % commit
    data = {
        "source": source,
        "settings": settings_of(world, args, logic),
        "levels": {
            "Sword": ["Fighter Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
            "Glove": ["Power Glove", "Titans Mitts"],
            "Bow": ["Bow", "Silver Arrows"],
            "Shield": ["Blue Shield", "Red Shield", "Mirror Shield"],
        },
        "dungeons": dungeons,
    }
    stats = {
        "build_seconds": round(built - started, 2),
        "first_sweep_seconds": round(first_sweep, 4),
        "sweeps": model.sweeps,
        "sweep_seconds": round(model.sweep_seconds, 1),
        "total_seconds": round(time.time() - started, 1),
        "units": len(model.unit_names),
        "locations": sum(len(d["locations"]) + len(d["unreachable"]) for d in dungeons.values()),
        "unreachable": [n for d in dungeons.values() for n in d["unreachable"]],
    }
    return data, stats


LINE_WIDTH = 100


def to_json(value, indent=0, tail=0):
    """JSON laid out the way the repository's formatter (Biome, line width 100) lays it out, so a
    fresh export needs no formatting pass: objects open one member per line, and an array sits on
    one line when it fits, else one element per line. `tail` counts what follows on the line."""
    pad = " " * indent
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = list(value.items())
        lines = []
        for position, (key, item) in enumerate(items):
            comma = 1 if position < len(items) - 1 else 0
            prefix = "%s  %s: " % (pad, json.dumps(key, ensure_ascii=False))
            lines.append(prefix + to_json(item, indent + 2, len(prefix) + comma) + ("," if comma else ""))
        return "{\n%s\n%s}" % ("\n".join(lines), pad)
    if isinstance(value, list):
        if not value:
            return "[]"
        if not any(isinstance(item, dict) for item in value):
            flat = json.dumps(value, ensure_ascii=False, separators=(", ", ": "))
            if tail + len(flat) <= LINE_WIDTH:
                return flat
        lines = []
        for position, item in enumerate(value):
            comma = 1 if position < len(value) - 1 else 0
            prefix = pad + "  "
            lines.append(prefix + to_json(item, indent + 2, len(prefix) + comma) + ("," if comma else ""))
        return "[\n%s\n%s]" % ("\n".join(lines), pad)
    return json.dumps(value, ensure_ascii=False)


def check(checkout, logic):
    checkout = load_engine(checkout)
    world, _ = build_world(logic)
    model = Model(world)
    full = model.reach()
    missing = [t.name if k == "loc" else "entry of %s" % t for i, (k, t) in enumerate(model.targets) if i not in full]
    counts = {}
    for location in model.locations:
        code = DUNGEON_CODES[location.parent_region.dungeon.name]
        counts[code] = counts.get(code, 0) + 1
    if len(counts) != len(DUNGEON_CODES):
        raise SystemExit("check failed: dungeons without locations: %s" % sorted(set(DUNGEON_CODES.values()) - set(counts)))
    if missing:
        raise SystemExit("check failed (%s): the full inventory does not reach %s" % (logic, ", ".join(missing)))
    print("check ok (%s): the full inventory reaches all %d dungeon locations and every entry; %s"
          % (logic, len(model.locations), ", ".join("%s %d" % (c, counts[c]) for c in DUNGEON_CODES.values())))


def main(argv):
    if len(argv) not in (3, 4) or argv[2] not in LOGICS:
        raise SystemExit(__doc__)
    checkout, logic = argv[1], argv[2]
    if len(argv) == 4 and argv[3] == "--check":
        check(checkout, logic)
        return
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.join(here, "..", "prompts", "alttp", "logic", LOGICS[logic])
    out_path = os.path.abspath(argv[3] if len(argv) == 4 else default_out)
    data, stats = export(checkout, logic)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(to_json(data))
        handle.write("\n")
    print("wrote %s" % out_path)
    print(json.dumps(stats))


if __name__ == "__main__":
    main(sys.argv)
