import { describe, expect, it } from "vitest";
import { dmLogDay, renderDmLog } from "../../src/handlers/dmlog.js";
import type { DmEntry, DmLogView } from "../../src/store/dmlog.js";

// Built from code points so this file itself holds no dash characters.
const EM_OR_EN_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

const ANN = "111111111111111111";
const BEN = "222222222222222222";

function entry(over: Partial<DmEntry> = {}): DmEntry {
  return {
    // 18:32 UTC on October 17 is 14:32 in New York (EDT).
    ts: "2026-10-17T18:32:05.000Z",
    userId: ANN,
    userName: "Ann",
    question: "who streams tonight",
    route: "schedule",
    response: "Stage 1 does.",
    ...over,
  };
}

function view(over: Partial<DmLogView> = {}): DmLogView {
  return {
    day: "2026-10-17",
    total: 1,
    users: [{ userId: ANN, userName: "Ann", count: 1 }],
    entries: [entry()],
    ...over,
  };
}

describe("renderDmLog", () => {
  it("says so plainly when there were no DMs", () => {
    expect(renderDmLog(view({ total: 0, users: [], entries: [] }))).toBe(
      "DM log for 2026-10-17: no DMs.",
    );
  });

  it("opens with the day and the total, then one line per person, then the entries", () => {
    const text = renderDmLog(
      view({
        total: 3,
        users: [
          { userId: ANN, userName: "Ann", count: 2 },
          { userId: BEN, userName: "Ben", count: 1 },
        ],
        entries: [
          entry({ ts: "2026-10-17T18:00:00.000Z", question: "first" }),
          entry({
            ts: "2026-10-17T19:05:00.000Z",
            userId: BEN,
            userName: "Ben",
            question: "second",
          }),
        ],
      }),
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("DM log for 2026-10-17: 3 total from 2 people");
    expect(lines[1]).toBe(`Ann (\`${ANN}\`): 2`);
    expect(lines[2]).toBe(`Ben (\`${BEN}\`): 1`);
    // Newest first, on the community clock, the response on the next line.
    expect(text.indexOf("15:05 Ben: second")).toBeLessThan(text.indexOf("14:00 Ann: first"));
    expect(text).toContain("14:00 Ann: first\n> Stage 1 does.");
  });

  it("uses the singular for one person", () => {
    expect(renderDmLog(view()).split("\n")[0]).toBe("DM log for 2026-10-17: 1 total from 1 person");
  });

  it("clips a long response to about 120 characters", () => {
    const text = renderDmLog(view({ entries: [entry({ response: "r".repeat(400) })] }));
    const reply = text.split("\n").find((l) => l.startsWith("> "));
    expect(reply).toBeDefined();
    expect((reply ?? "").length).toBeLessThanOrEqual(2 + 120);
    expect(reply?.endsWith("...")).toBe(true);
  });

  it("marks a refused attempt instead of showing an empty response", () => {
    const text = renderDmLog(view({ entries: [entry({ route: "rate_limited", response: "" })] }));
    expect(text).toContain("> (refused, daily limit reached)");
  });

  it("shows a placeholder for an empty answer and unknown for a missing name", () => {
    const text = renderDmLog(
      view({
        users: [{ userId: ANN, userName: null, count: 1 }],
        entries: [entry({ userName: "", response: "" })],
      }),
    );
    expect(text).toContain(`unknown (\`${ANN}\`): 1`);
    expect(text).toContain("unknown: who streams tonight\n> (no text)");
  });

  it("writes plain names: no backticks, angle brackets or line breaks from user text", () => {
    const text = renderDmLog(
      view({
        users: [{ userId: ANN, userName: "<@123>`x`\nEvil", count: 1 }],
        entries: [entry({ userName: "<@123>`x`\nEvil", question: "a\n\nb `c` <@&9>" })],
      }),
    );
    expect(text).not.toContain("<");
    expect(text).not.toContain("@123>");
    expect(text).toContain("@123x Evil (`111111111111111111`): 1");
    expect(text).toContain("a b c @&9");
    expect(text).not.toMatch(EM_OR_EN_DASH);
  });

  it("stays under 2000 characters and trims the oldest entries first, saying how many", () => {
    const entries = Array.from({ length: 20 }, (_, n) =>
      entry({
        ts: `2026-10-17T18:${String(n).padStart(2, "0")}:00.000Z`,
        question: `question ${n} ${"q".repeat(300)}`,
        response: "r".repeat(500),
      }),
    );
    const text = renderDmLog(
      view({ total: 20, users: [{ userId: ANN, userName: "Ann", count: 20 }], entries }),
    );
    expect(text.length).toBeLessThan(2000);
    expect(text).toContain("question 19 ");
    expect(text).not.toContain("question 0 ");
    const trimmed = /\((\d+) older entries trimmed\)/.exec(text);
    expect(trimmed).not.toBeNull();
    const shown = (text.match(/question \d+ /g) ?? []).length;
    expect(shown + Number(trimmed?.[1])).toBe(20);
    expect(text.trimEnd().endsWith("trimmed)")).toBe(true);
  });

  it("says nothing about trimming when every entry fits", () => {
    expect(renderDmLog(view())).not.toContain("trimmed");
  });

  it("keeps the whole message under 2000 characters with a hundred people", () => {
    const users = Array.from({ length: 100 }, (_, n) => ({
      userId: String(300000000000000000 + n),
      userName: `Person number ${n}`,
      count: 100 - n,
    }));
    const text = renderDmLog(view({ total: 5050, users }));
    expect(text.length).toBeLessThan(2000);
    expect(text).toMatch(/\.\.\.and \d+ more people/);
    expect(text).toContain("Person number 0 ");
  });
});

describe("dmLogDay", () => {
  const NOW = new Date("2026-10-18T02:00:00Z"); // 22:00 on the 17th in New York

  function interaction(options: unknown[] | undefined) {
    return { data: { name: "dmlog", options } } as never;
  }

  it("defaults to today on the community clock", () => {
    expect(dmLogDay(interaction(undefined), NOW)).toBe("2026-10-17");
    expect(dmLogDay(interaction([]), NOW)).toBe("2026-10-17");
    expect(dmLogDay(interaction([{ name: "day", type: 3, value: "  " }]), NOW)).toBe("2026-10-17");
  });

  it("accepts a real YYYY-MM-DD", () => {
    expect(dmLogDay(interaction([{ name: "day", type: 3, value: " 2026-10-01 " }]), NOW)).toBe(
      "2026-10-01",
    );
  });

  it.each(["tomorrow", "2026-10-1", "2026-02-30", "10/17/2026", "2026-10-17T00:00"])(
    "refuses %s",
    (value) => {
      expect(() => dmLogDay(interaction([{ name: "day", type: 3, value }]), NOW)).toThrow(
        "YYYY-MM-DD",
      );
    },
  );
});
