import { describe, expect, it } from "vitest";
import { interactionTools } from "../../src/responders/base.js";
import { clientToolDefs } from "../../src/responders/clientTools.js";
import { ROUTER_SCHEMA } from "../../src/router/router.js";
import { ROUTES } from "../../src/router/routes.js";

// Anthropic strict tool use and structured output reject these keywords with an HTTP 400.
// Limits belong in the property description and in the zod check that runs before the tool.
const FORBIDDEN = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
]);

function violations(node: unknown, path: string): string[] {
  if (Array.isArray(node)) return node.flatMap((v, i) => violations(v, `${path}[${i}]`));
  if (typeof node !== "object" || node === null) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    // Property names inside "properties" are free text, so only their schemas are walked.
    if (key === "properties" && typeof value === "object" && value !== null) {
      for (const [prop, schema] of Object.entries(value)) {
        out.push(...violations(schema, `${path}.properties.${prop}`));
      }
      continue;
    }
    if (FORBIDDEN.has(key)) out.push(`${path}.${key}`);
    if (key === "type" && Array.isArray(value)) out.push(`${path}.type is an array`);
    out.push(...violations(value, `${path}.${key}`));
  }
  return out;
}

describe("schemas sent to Anthropic", () => {
  it("the checker catches every forbidden keyword", () => {
    for (const keyword of FORBIDDEN) {
      const schema = { properties: { a: { type: "integer", [keyword]: 1 } } };
      expect(violations(schema, "t")).toHaveLength(1);
    }
    expect(violations({ type: ["string", "null"] }, "t")).toHaveLength(1);
  });

  it("no client tool uses an unsupported keyword", () => {
    const all = clientToolDefs(["matches_for_me", "challonge_bracket"]);
    expect(violations(all, "clientTools")).toEqual([]);
  });

  it("no interaction tool, on any route, uses an unsupported keyword", () => {
    for (const spec of Object.values(ROUTES)) {
      expect(violations(interactionTools(spec), `interaction.${spec.route}`)).toEqual([]);
    }
  });

  it("the router output schema uses no unsupported keyword", () => {
    expect(violations(ROUTER_SCHEMA, "router")).toEqual([]);
  });
});
