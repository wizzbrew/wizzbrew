import { describe, expect, it } from "vitest";
import { SHARED_RULES, SPECS } from "../../src/responders/specs.js";
import { ROUTES } from "../../src/router/routes.js";
import type { Route } from "../../src/types.js";

const routes = Object.keys(ROUTES) as Route[];
const dashes = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`);
const texts: [string, string][] = [
  ["SHARED_RULES", SHARED_RULES],
  ...routes.map((r): [string, string] => [r, SPECS[r].instructions]),
];

const allTools = new Set<string>();
for (const r of routes) {
  for (const t of [...ROUTES[r].readTools, ...ROUTES[r].writeTools, ...ROUTES[r].clientTools]) {
    allTools.add(t);
  }
}

const mentions = (text: string, tool: string): boolean =>
  new RegExp(`(^|[^a-z_])${tool}([^a-z_]|$)`).test(text);

describe("specs", () => {
  it("has a spec for every route with the right register", () => {
    for (const r of routes) {
      expect(SPECS[r].route).toBe(r);
      const want = r === "help" ? "help" : r === "chat" ? "chat" : "data";
      expect(SPECS[r].register).toBe(want);
      expect(SPECS[r].instructions.length).toBeGreaterThan(0);
    }
  });

  it("SHARED_RULES carries the required pieces", () => {
    for (const s of [
      "<t:",
      "offer_choices",
      "propose_action",
      "tenant",
      "Wizzrobe doesn't show that",
    ]) {
      expect(SHARED_RULES).toContain(s);
    }
  });

  it("each spec mentions only tools its route may use", () => {
    for (const r of routes) {
      const own = new Set<string>([
        ...ROUTES[r].readTools,
        ...ROUTES[r].writeTools,
        ...ROUTES[r].clientTools,
      ]);
      for (const tool of allTools) {
        if (mentions(SPECS[r].instructions, tool)) {
          expect(own.has(tool), `${r} mentions ${tool}`).toBe(true);
        }
      }
    }
  });

  it("names the key tools in the right routes", () => {
    expect(SPECS.crew.instructions).toContain("propose_action");
    expect(SPECS.player_actions.instructions).toContain("propose_action");
    expect(SPECS.standings.instructions).toContain("challonge_bracket");
    expect(SPECS.players.instructions).toContain("challonge_bracket");
    expect(SPECS.schedule.instructions).toContain("matches_for_me");
  });

  it("avoids sample phrasing, trailing question marks and dashes", () => {
    for (const [name, text] of texts) {
      for (const bad of ["e.g.", "for example", "such as"]) {
        expect(text.toLowerCase(), `${name}: ${bad}`).not.toContain(bad);
      }
      for (const line of text.split("\n")) {
        expect(line.trimEnd().endsWith("?"), `${name}: ${line}`).toBe(false);
      }
      expect(dashes.test(text), name).toBe(false);
    }
  });
});
