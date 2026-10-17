import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_MD,
  KNOWLEDGE_TS,
  renderKnowledgeModule,
} from "../../scripts/build-knowledge.js";
import { ALTTP_KNOWLEDGE } from "../../src/personality/knowledge.js";

// Built from char codes so this file passes the dash scan.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

// Building the knowledge module is a manual step: npx tsx scripts/build-knowledge.ts. These tests
// fail when the markdown was edited without rerunning it.
describe("ALTTP knowledge", () => {
  const markdown = readFileSync(KNOWLEDGE_MD, "utf8");

  it("matches the markdown it is generated from", () => {
    expect(ALTTP_KNOWLEDGE).toBe(markdown);
  });

  it("is exactly what the build script would write", () => {
    expect(readFileSync(KNOWLEDGE_TS, "utf8")).toBe(renderKnowledgeModule(markdown));
  });

  it("renders a header, then one constant holding the text as a JSON string", () => {
    const sample = 'a "quoted" line\n→ arrow and `ticks` and back\\slash\n';
    const out = renderKnowledgeModule(sample);
    expect(out.startsWith("// Generated from prompts/alttp-game-knowledge.md")).toBe(true);
    expect(out).toContain("Do not edit; edit the markdown and rerun.");
    const start =
      out.indexOf("export const ALTTP_KNOWLEDGE = ") + "export const ALTTP_KNOWLEDGE = ".length;
    const literal = out.slice(start).replace(/;\n$/, "");
    expect(JSON.parse(literal)).toBe(sample);
  });

  it("has no em or en dashes and drops the meta text meant for another tool", () => {
    expect(markdown).not.toContain(EM);
    expect(markdown).not.toContain(EN);
    expect(markdown.startsWith("# ")).toBe(true);
    expect(markdown).not.toContain("**Purpose.**");
    expect(markdown).not.toContain("This document was generated");
  });
});
