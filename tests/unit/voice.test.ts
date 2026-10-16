import { describe, expect, it } from "vitest";
import {
  CHAT_BLOCK,
  CORE,
  DATA_BLOCK,
  HELP_BLOCK,
  type Register,
  voice,
} from "../../src/personality/voice.js";

const REGISTERS: Register[] = ["data", "help", "chat"];
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

describe("voice", () => {
  it("returns CORE, a blank line, then the register block", () => {
    expect(voice("data")).toBe(`${CORE}\n\n${DATA_BLOCK}`);
    expect(voice("help")).toBe(`${CORE}\n\n${HELP_BLOCK}`);
    expect(voice("chat")).toBe(`${CORE}\n\n${CHAT_BLOCK}`);
  });

  it("gives a different result for each register", () => {
    const results = new Set(REGISTERS.map((r) => voice(r)));
    expect(results.size).toBe(3);
  });

  it("is identical on every call", () => {
    for (const r of REGISTERS) {
      expect(voice(r)).toBe(voice(r));
    }
  });

  it("stays short", () => {
    expect(CORE.length).toBeLessThan(1200);
    for (const block of [DATA_BLOCK, HELP_BLOCK, CHAT_BLOCK]) {
      expect(block.length).toBeLessThan(500);
    }
  });

  it("has no em or en dashes", () => {
    for (const r of REGISTERS) {
      const text = voice(r);
      expect(text).not.toContain(EM_DASH);
      expect(text).not.toContain(EN_DASH);
    }
  });

  it("lists no sample phrasings", () => {
    for (const r of REGISTERS) {
      const text = voice(r).toLowerCase();
      expect(text).not.toContain("e.g.");
      expect(text).not.toContain("for example");
      expect(text).not.toContain("such as");
    }
  });

  it("keeps chat warm: no help-list exit, one turn of phrase", () => {
    const text = CHAT_BLOCK.toLowerCase();
    expect(text).not.toContain("the schedule, streams");
    expect(text).toContain("never answer casual talk with a list");
    expect(text).toContain("at most one");
  });

  it("forbids flavor in the data register in plain words", () => {
    expect(DATA_BLOCK).toContain("No flavor");
  });

  it("has no double-quoted phrase longer than three words", () => {
    for (const r of REGISTERS) {
      const quoted = voice(r).matchAll(/["“]([^"“”]+)["”]/g);
      for (const match of quoted) {
        const words = (match[1] ?? "").trim().split(/\s+/).filter(Boolean);
        expect(words.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
