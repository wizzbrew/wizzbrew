import { describe, expect, it, vi } from "vitest";
import { decodeCustomId } from "../../src/discord/components.js";
import { renderAnswer, renderError } from "../../src/discord/render.js";
import type { Answer } from "../../src/types.js";

// T03 builds the real finalizeText in parallel; this naive split keeps the
// render tests independent of it.
vi.mock("../../src/discord/markup.js", () => ({
  finalizeText: (text: string): string[] => {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 2000) {
      chunks.push(text.slice(i, i + 2000));
    }
    return chunks;
  },
}));

type Button = { type: number; style: number; label: string; custom_id: string };
type Row = { type: number; components: Button[] };

// discord-api-types models payload components as a wide union. The tests only
// need action rows and buttons, so they read them through this shape.
function rowsOf(payload: unknown): Row[] {
  return (payload as { components?: Row[] } | undefined)?.components ?? [];
}

const NO_MENTIONS = { parse: [] };

describe("renderAnswer", () => {
  it("renders text only with no components", () => {
    const answer: Answer = {
      text: "Round 3 starts at <t:1767225600:t>.",
      ephemeral: false,
    };
    const payloads = renderAnswer(answer);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({
      content: answer.text,
      embeds: [],
      components: [],
      allowed_mentions: NO_MENTIONS,
    });
    expect(payloads).toMatchSnapshot();
  });

  it("passes embeds through on payload 0", () => {
    const answer: Answer = {
      text: "Standings for group A.",
      embeds: [{ title: "Group A", description: "1. Alpha, 2. Bravo" }],
      ephemeral: false,
    };
    const payloads = renderAnswer(answer);
    expect(payloads[0]?.embeds).toEqual([{ title: "Group A", description: "1. Alpha, 2. Bravo" }]);
    expect(payloads).toMatchSnapshot();
  });

  it("adds a Confirm and Cancel row when pendingId is given", () => {
    const answer: Answer = {
      text: "Confirm signing up as crew for match 42?",
      ephemeral: true,
    };
    const payloads = renderAnswer(answer, { pendingId: "p1" });
    const rows = rowsOf(payloads[0]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe(1);
    const [confirm, cancel] = rows[0]?.components ?? [];
    expect(confirm).toMatchObject({ type: 2, style: 3, label: "Confirm" });
    expect(cancel).toMatchObject({ type: 2, style: 4, label: "Cancel" });
    expect(decodeCustomId(confirm?.custom_id ?? "")).toEqual({
      kind: "confirm",
      pendingId: "p1",
    });
    expect(decodeCustomId(cancel?.custom_id ?? "")).toEqual({
      kind: "cancel",
      pendingId: "p1",
    });
    expect(payloads).toMatchSnapshot();
  });

  it("adds one row of five secondary choice buttons for six choices", () => {
    const answer: Answer = {
      text: "Which tournament did you mean?",
      choices: [
        { label: "Alpha Cup", value: "v1" },
        { label: "Bravo Cup", value: "v2" },
        { label: "Charlie Cup", value: "v3" },
        { label: "Delta Cup", value: "v4" },
        { label: "Echo Cup", value: "v5" },
        { label: "Foxtrot Cup", value: "v6" },
      ],
      ephemeral: true,
    };
    const payloads = renderAnswer(answer, { threadId: "t1" });
    const rows = rowsOf(payloads[0]);
    expect(rows).toHaveLength(1);
    const buttons = rows[0]?.components ?? [];
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toMatchObject({ type: 2, style: 2 });
    }
    expect(buttons[0]?.label).toBe("Alpha Cup");
    expect(decodeCustomId(buttons[0]?.custom_id ?? "")).toEqual({
      kind: "choose",
      threadId: "t1",
      value: "v1",
    });
    expect(payloads).toMatchSnapshot();
  });

  it("skips a choice whose custom id would exceed 100 characters", () => {
    const answer: Answer = {
      text: "Pick one.",
      choices: [
        { label: "Too long", value: "a".repeat(90) },
        { label: "Exactly fits", value: "a".repeat(87) },
        { label: "Short", value: "b" },
      ],
      ephemeral: false,
    };
    const rows = rowsOf(renderAnswer(answer, { threadId: "t1" })[0]);
    expect(rows[0]?.components.map((b) => b.label)).toEqual(["Exactly fits", "Short"]);
  });

  it("cuts a choice label to 80 characters", () => {
    const answer: Answer = {
      text: "Pick one.",
      choices: [{ label: "x".repeat(120), value: "v1" }],
      ephemeral: false,
    };
    const rows = rowsOf(renderAnswer(answer, { threadId: "t1" })[0]);
    expect(rows[0]?.components[0]?.label).toHaveLength(80);
  });

  it("splits a 4500-char ephemeral answer into three payloads with the flag on followups", () => {
    const answer: Answer = {
      text: "a".repeat(4500),
      ephemeral: true,
    };
    const payloads = renderAnswer(answer);
    expect(payloads).toHaveLength(3);
    expect(payloads[0]).not.toHaveProperty("flags");
    expect(payloads[1]).toHaveProperty("flags", 64);
    expect(payloads[2]).toHaveProperty("flags", 64);
    expect(payloads.map((p) => p.content?.length)).toEqual([2000, 2000, 500]);
    expect(payloads[1]).not.toHaveProperty("embeds");
    expect(payloads).toMatchSnapshot();
  });

  it("gives no flags to a public multi-part answer", () => {
    const answer: Answer = { text: "b".repeat(2500), ephemeral: false };
    const payloads = renderAnswer(answer);
    expect(payloads).toHaveLength(2);
    for (const payload of payloads) {
      expect(payload).not.toHaveProperty("flags");
    }
  });

  it("sets allowed_mentions to empty parse on every payload", () => {
    const answer: Answer = {
      text: "@everyone <@&123> ".repeat(300),
      choices: [{ label: "Pick", value: "v1" }],
      ephemeral: true,
    };
    const payloads = renderAnswer(answer, { pendingId: "p1", threadId: "t1" });
    expect(payloads.length).toBeGreaterThan(1);
    for (const payload of payloads) {
      expect(payload.allowed_mentions).toEqual(NO_MENTIONS);
    }
  });

  it("adds the follow-up button only without choices and without pendingId", () => {
    const plain = rowsOf(renderAnswer({ text: "Hi.", ephemeral: false }, { threadId: "t1" })[0]);
    expect(plain).toHaveLength(1);
    expect(plain[0]?.components).toEqual([
      { type: 2, style: 2, label: "Ask a follow-up", custom_id: "wb:followup:t1" },
    ]);
    const withChoices = rowsOf(
      renderAnswer(
        { text: "Hi.", choices: [{ label: "A", value: "a" }], ephemeral: false },
        { threadId: "t1" },
      )[0],
    );
    expect(withChoices.flatMap((r) => r.components.map((b) => b.custom_id))).toEqual([
      "wb:choose:t1:a",
    ]);
    const withPending = rowsOf(
      renderAnswer({ text: "Hi.", ephemeral: false }, { pendingId: "p1", threadId: "t1" })[0],
    );
    expect(withPending.flatMap((r) => r.components.map((b) => b.label))).toEqual([
      "Confirm",
      "Cancel",
    ]);
  });

  it("returns components as an empty array when no ids are given", () => {
    const payloads = renderAnswer({
      text: "Plain.",
      choices: [{ label: "Pick", value: "v1" }],
      ephemeral: false,
    });
    expect(payloads[0]?.components).toEqual([]);
  });

  it("throws when finalizeText returns no chunks", () => {
    expect(() => renderAnswer({ text: "", ephemeral: false })).toThrow(
      "finalizeText returned no chunks",
    );
  });
});

describe("renderError", () => {
  it("returns the error shape with no embeds or components", () => {
    expect(renderError("Something went wrong.", true)).toEqual({
      content: "Something went wrong.",
      embeds: [],
      components: [],
      allowed_mentions: NO_MENTIONS,
    });
  });

  it("keeps only the first chunk of a long message", () => {
    const payload = renderError("c".repeat(2500), false);
    expect(payload.content).toHaveLength(2000);
    expect(payload.allowed_mentions).toEqual(NO_MENTIONS);
  });
});
