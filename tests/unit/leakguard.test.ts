import { describe, expect, it } from "vitest";
import {
  buildLeakGuard,
  isPromptLeak,
  LEAK_REFUSAL,
  leakWindows,
  PROTECTED_TEXTS,
} from "../../src/discord/leakguard.js";
import { ALTTP_KNOWLEDGE } from "../../src/personality/knowledge.js";
import { CORE } from "../../src/personality/voice.js";
import { KNOWLEDGE_FRAMING, PROPOSE_ACTION_DESCRIPTION } from "../../src/responders/fixedtext.js";
import { SHARED_RULES, SPECS } from "../../src/responders/specs.js";
import { ROUTER_PROMPT } from "../../src/router/prompt.js";

const dashes = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`);

// 80 characters in the middle of CORE's first paragraph.
const CHUNK = CORE.slice(40, 120);

describe("isPromptLeak", () => {
  it("catches a verbatim 80 character chunk of CORE", () => {
    expect(CHUNK).toHaveLength(80);
    expect(isPromptLeak(CHUNK)).toBe(true);
    expect(isPromptLeak(`Sure, here it is: ${CHUNK} and that is all.`)).toBe(true);
  });

  it("catches the same chunk with different casing and whitespace", () => {
    const messy = CHUNK.toUpperCase().replace(/ /g, "  \n\t ");
    expect(messy).not.toContain(CHUNK);
    expect(isPromptLeak(messy)).toBe(true);
  });

  it("does not catch a 30 character fragment", () => {
    const fragment = CORE.slice(40, 70);
    expect(fragment).toHaveLength(30);
    expect(isPromptLeak(fragment)).toBe(false);
    expect(isPromptLeak(`Quoting a bit: ${fragment}, nothing more.`)).toBe(false);
  });

  it("does not catch a paraphrase", () => {
    const paraphrase =
      "I act like a warm regular at the bar, keep answers short and plain, never talk down to anyone, and say so when Wizzrobe does not show something instead of guessing.";
    expect(isPromptLeak(paraphrase)).toBe(false);
  });

  it("does not catch a normal schedule answer", () => {
    const answer = [
      "**Earth stage**",
      "<t:1792083600:f> (<t:1792083600:R>): Pixelfox vs Nimbus, ALttPR Open.",
      "<t:1792090800:f>: Quartz vs Ember, ALttPR Open.",
      "Nothing else is on Earth that day.",
    ].join("\n");
    expect(isPromptLeak(answer)).toBe(false);
  });

  it("does not catch a chunk of the game reference", () => {
    expect(isPromptLeak(ALTTP_KNOWLEDGE.slice(2000, 2500))).toBe(false);
    expect(isPromptLeak(ALTTP_KNOWLEDGE.slice(0, 1500))).toBe(false);
  });

  it("does not catch an empty answer", () => {
    expect(isPromptLeak("")).toBe(false);
    expect(isPromptLeak("   \n ")).toBe(false);
  });

  it("catches a run of 79 characters starting anywhere in the first 200 of CORE", () => {
    // Windows are cut from the whitespace-collapsed text, so the guarantee is in those terms.
    const collapsed = CORE.replace(/\s+/g, " ");
    for (let at = 0; at < 200; at++) {
      const run = collapsed.slice(at, at + 79);
      expect(run).toHaveLength(79);
      expect(isPromptLeak(run), `offset ${at}`).toBe(true);
    }
  });

  it("protects every kind of fixed prompt text", () => {
    const probes: [string, string][] = [
      ["shared rules", SHARED_RULES.slice(300, 400)],
      ["spec instructions", SPECS.crew.instructions.slice(100, 200)],
      ["router prompt", ROUTER_PROMPT.slice(500, 600)],
      ["knowledge framing", KNOWLEDGE_FRAMING],
      ["tool description", PROPOSE_ACTION_DESCRIPTION],
    ];
    for (const [name, text] of probes) {
      expect(isPromptLeak(text), name).toBe(true);
    }
  });

  it("leaves the reference material out of the protected set", () => {
    expect(PROTECTED_TEXTS).not.toContain(ALTTP_KNOWLEDGE);
  });

  it("answers a 2000 character reply in well under a millisecond", () => {
    const answer = ALTTP_KNOWLEDGE.slice(3000, 5000);
    expect(answer).toHaveLength(2000);
    isPromptLeak(answer);
    const runs = 200;
    const started = performance.now();
    for (let i = 0; i < runs; i++) isPromptLeak(answer);
    const each = (performance.now() - started) / runs;
    // Measured near 0.06 ms; the limit leaves room for a slow CI machine.
    expect(each).toBeLessThan(1);
  });
});

describe("buildLeakGuard", () => {
  const prose =
    "The quick brown fox jumps over the lazy dog while the band plays on and on tonight.";

  it("matches a window of the protected text and nothing unrelated", () => {
    const guard = buildLeakGuard([prose]);
    expect(guard(prose.slice(0, 60))).toBe(true);
    expect(guard(`prefix ${prose.slice(20, 80)} suffix`)).toBe(true);
    // Neither aligned window fits inside this 65 character run.
    expect(guard(prose.slice(10, 75))).toBe(false);
    expect(guard("A completely different sentence that shares no sixty character run.")).toBe(
      false,
    );
  });

  it("skips protected texts shorter than a window", () => {
    const guard = buildLeakGuard(["Short secret text under sixty characters."]);
    expect(guard("Short secret text under sixty characters. And then some more words.")).toBe(
      false,
    );
    expect(leakWindows(["Short secret text under sixty characters."])).toEqual([]);
  });

  it("skips windows that are mostly punctuation", () => {
    const rule = "=".repeat(100);
    expect(leakWindows([rule])).toEqual([]);
    expect(buildLeakGuard([rule])("=".repeat(200))).toBe(false);
  });

  it("builds windows of 60 characters at a stride of 20, normalized", () => {
    const windows = leakWindows(["Abc  def\nghi ".repeat(20)]);
    for (const w of windows) {
      expect(w).toHaveLength(60);
      expect(w).toBe(w.toLowerCase());
      expect(w).not.toMatch(/\s\s/);
    }
    expect(windows.length).toBeGreaterThan(0);
  });

  it("has no windows to match when given no texts", () => {
    expect(buildLeakGuard([])(prose)).toBe(false);
  });
});

describe("LEAK_REFUSAL", () => {
  it("is one plain line with no dashes that is not itself a leak", () => {
    expect(LEAK_REFUSAL).not.toContain("\n");
    expect(dashes.test(LEAK_REFUSAL)).toBe(false);
    expect(LEAK_REFUSAL.length).toBeLessThan(80);
    expect(isPromptLeak(LEAK_REFUSAL)).toBe(false);
  });
});
