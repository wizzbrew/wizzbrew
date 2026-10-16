import { describe, expect, it } from "vitest";
import {
  type ComponentAction,
  decodeCustomId,
  encodeCustomId,
} from "../../src/discord/components.js";

describe("encodeCustomId and decodeCustomId", () => {
  const cases: [string, ComponentAction, string][] = [
    ["confirm", { kind: "confirm", pendingId: "p_1-x" }, "wb:confirm:p_1-x"],
    ["cancel", { kind: "cancel", pendingId: "p_1-x" }, "wb:cancel:p_1-x"],
    ["choose", { kind: "choose", threadId: "t1", value: "v1" }, "wb:choose:t1:v1"],
    ["followup", { kind: "followup", threadId: "t1" }, "wb:followup:t1"],
    ["change", { kind: "change", pendingId: "p1", threadId: "t1" }, "wb:change:p1:t1"],
    ["private", { kind: "private", threadId: "t1" }, "wb:private:t1"],
  ];

  for (const [name, action, expected] of cases) {
    it(`round-trips ${name}`, () => {
      const id = encodeCustomId(action);
      expect(id).toBe(expected);
      expect(decodeCustomId(id)).toEqual(action);
    });
  }

  it("round-trips a choose value that contains colons", () => {
    const action: ComponentAction = {
      kind: "choose",
      threadId: "t1",
      value: "10:30:list:x",
    };
    const id = encodeCustomId(action);
    expect(id).toBe("wb:choose:t1:10:30:list:x");
    expect(decodeCustomId(id)).toEqual(action);
  });

  it.each([
    "wb:nope:x",
    "xx:confirm:a",
    "wb:confirm:",
    "wb:choose:t1",
    "wb:choose:t1:",
    "wb:choose::v1",
    "wb:followup:",
    "wb:change:p1",
    "wb:change:p1:",
    "wb:private:",
    "wb:private:t1:x",
    "wb:followup:t1:v1",
    "wb:confirm:a b",
    "wb:confirm:a:b",
    `wb:confirm:${"a".repeat(41)}`,
    "",
  ])("decodes %j to null", (id) => {
    expect(decodeCustomId(id)).toBeNull();
  });

  it("decodes a 100-character id and rejects a 101-character one", () => {
    const fits = `wb:choose:t1:${"a".repeat(87)}`;
    const tooLong = `wb:choose:t1:${"a".repeat(88)}`;
    expect(fits).toHaveLength(100);
    expect(tooLong).toHaveLength(101);
    expect(decodeCustomId(fits)).toEqual({
      kind: "choose",
      threadId: "t1",
      value: "a".repeat(87),
    });
    expect(decodeCustomId(tooLong)).toBeNull();
  });

  it("encode throws when the result would exceed 100 characters", () => {
    expect(() =>
      encodeCustomId({
        kind: "choose",
        threadId: "t1",
        value: "a".repeat(88),
      }),
    ).toThrow(Error);
    expect(
      encodeCustomId({
        kind: "choose",
        threadId: "t1",
        value: "a".repeat(87),
      }),
    ).toHaveLength(100);
  });

  it("encode rejects ids with spaces or over 40 characters", () => {
    expect(() => encodeCustomId({ kind: "confirm", pendingId: "a b" })).toThrow(Error);
    expect(() => encodeCustomId({ kind: "cancel", pendingId: "a".repeat(41) })).toThrow(Error);
    expect(() => encodeCustomId({ kind: "choose", threadId: "", value: "v" })).toThrow(Error);
  });

  it("encode rejects an empty choose value", () => {
    expect(() => encodeCustomId({ kind: "choose", threadId: "t1", value: "" })).toThrow(Error);
  });
});
