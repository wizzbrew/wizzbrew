import { beforeEach, describe, expect, it } from "vitest";
import { createPending, loadThread, saveThread, takePending } from "../../src/actions/pending.js";
import { setKvForTests } from "../../src/store/kv.js";
import type { ProposedAction } from "../../src/types.js";
import { FakeKv } from "../fakes/kv.js";

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);
const at = (sec: number): Date => new Date(T0 + sec * 1000);
const ME = "111111111111111111";
const OTHER = "222222222222222222";
const action: ProposedAction = {
  tool: "acknowledge_match",
  args: { match_id: 5 },
  summary: "Acknowledge match 5",
};
const thread = {
  id: "ignored",
  discordUserId: ME,
  question: "who is on stage one",
  turns: [] as { role: "user" | "assistant"; text: string }[],
  decision: { route: "schedule" as never, confidence: 0.9, params: {}, reason: "test" },
  ephemeral: false,
};

beforeEach(() => {
  setKvForTests(new FakeKv(() => T0));
});

describe("pending", () => {
  it("is single use", async () => {
    const p = await createPending(action, ME, at(0));
    expect(p.expiresAt).toBe(T0 + 600000);
    expect(await takePending(p.id, ME, at(10))).toEqual(p);
    expect(await takePending(p.id, ME, at(11))).toBe("expired");
  });

  it("refuses another user and leaves the record", async () => {
    const p = await createPending(action, ME, at(0));
    expect(await takePending(p.id, OTHER, at(5))).toBe("not_yours");
    expect(await takePending(p.id, ME, at(6))).toEqual(p);
  });

  it("lets exactly one of two concurrent takes win", async () => {
    const p = await createPending(action, ME, at(0));
    const results = await Promise.all([takePending(p.id, ME, at(5)), takePending(p.id, ME, at(5))]);
    expect(results).toContainEqual(p);
    expect(results).toContain("expired");
  });

  it("puts the record back with its remaining TTL for another user", async () => {
    const p = await createPending(action, ME, at(0));
    expect(await takePending(p.id, OTHER, at(595))).toBe("not_yours");
    expect(await takePending(p.id, ME, at(596))).toEqual(p);
  });

  it("expires after 601 seconds", async () => {
    const p = await createPending(action, ME, at(0));
    expect(await takePending(p.id, ME, at(601))).toBe("expired");
  });

  it("makes 12 character alphanumeric ids that differ", async () => {
    const a = await createPending(action, ME, at(0));
    const b = await createPending(action, ME, at(0));
    expect(a.id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(a.id).not.toBe(b.id);
  });
});

describe("threads", () => {
  it("slides the TTL on load", async () => {
    const t = await saveThread(thread, at(0));
    expect(t.id).toMatch(/^[A-Za-z0-9]{12}$/);
    const first = await loadThread(t.id, ME, at(500));
    expect(first).toMatchObject({ expiresAt: T0 + 2300000 });
    const second = await loadThread(t.id, ME, at(1000));
    expect(second).toMatchObject({ id: t.id, expiresAt: T0 + 2800000 });
    expect(await loadThread(t.id, ME, at(2801))).toBe("expired");
  });

  it("keeps the last 6 turns, each cut to 1500 characters", async () => {
    const turns = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      text: `${i}${"x".repeat(2000)}`,
    }));
    const t = await saveThread({ ...thread, turns }, at(0));
    expect(t.expiresAt).toBe(T0 + 1800000);
    expect(t.turns).toHaveLength(6);
    expect(t.turns[0]?.text.startsWith("2x")).toBe(true);
    for (const turn of t.turns) expect(turn.text).toHaveLength(1500);
  });

  it("refuses another user on a private thread", async () => {
    const t = await saveThread({ ...thread, ephemeral: true }, at(0));
    expect(await loadThread(t.id, OTHER, at(5))).toBe("not_yours");
    expect(await loadThread(t.id, ME, at(6))).toMatchObject({ id: t.id });
  });

  it("lets another user load a public thread", async () => {
    const t = await saveThread({ ...thread, ephemeral: false }, at(0));
    expect(await loadThread(t.id, OTHER, at(5))).toMatchObject({ id: t.id, discordUserId: ME });
  });
});
