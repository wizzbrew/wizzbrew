import { describe, expect, it } from "vitest";
import { resolveByName } from "../../src/wizzrobe/resolve.js";

const asIs = (s: string): string => s;

describe("resolveByName", () => {
  it("is ambiguous with both names when a word prefix fits two", () => {
    expect(resolveByName("coop", ["COOP AD", "COOP Mystery"], asIs)).toEqual({
      kind: "ambiguous",
      options: ["COOP AD", "COOP Mystery"],
    });
  });

  it("prefers an exact name over a prefix", () => {
    expect(resolveByName("alttpr", ["ALTTPR", "ALTTPR Hybrid MG", "ALTTP Any% NMG"], asIs)).toEqual(
      { kind: "match", value: "ALTTPR" },
    );
  });

  it("is ambiguous when two names share a multi word prefix", () => {
    expect(
      resolveByName("super metroid", ["Super Metroid Any%", "Super Metroid Map Rando"], asIs),
    ).toEqual({
      kind: "ambiguous",
      options: ["Super Metroid Any%", "Super Metroid Map Rando"],
    });
  });

  it("matches by prefix across diacritics", () => {
    expect(resolveByName("Pokémon", ["Pokemon Crystal"], asIs)).toEqual({
      kind: "match",
      value: "Pokemon Crystal",
    });
  });

  it("drops a leading the before matching aliases", () => {
    expect(resolveByName("the earth", ["Earth", "Fire"], asIs)).toEqual({
      kind: "match",
      value: "Earth",
    });
  });

  it("does not match a fragment that is not a whole word", () => {
    expect(resolveByName("sm", ["SMZ3"], asIs)).toEqual({ kind: "none" });
  });

  it("returns none for empty and whitespace input", () => {
    expect(resolveByName("", ["Earth"], asIs)).toEqual({ kind: "none" });
    expect(resolveByName("   ", ["Earth"], asIs)).toEqual({ kind: "none" });
  });

  it("returns none for punctuation only input instead of matching a punctuation only name", () => {
    expect(resolveByName("!!!", ["???"], asIs)).toEqual({ kind: "none" });
  });

  it("is ambiguous when two names are exactly the same", () => {
    expect(resolveByName("Foo", ["Foo", "Foo"], asIs)).toEqual({
      kind: "ambiguous",
      options: ["Foo", "Foo"],
    });
  });

  it("uses nameOf for object items and returns the original item", () => {
    const items = [
      { id: 1, name: "Earth" },
      { id: 2, name: "Fire" },
    ];
    const result = resolveByName("the earth", items, (t) => t.name);
    expect(result).toEqual({ kind: "match", value: items[0] });
  });
});
