import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WizzrobeError } from "../../src/errors.js";
import { liveAnswer, scheduleAnswer } from "../../src/responders/direct.js";

const calls: { name: string; args: Record<string, unknown> }[] = [];
let schedules: Record<string, unknown> = {};
let failWith: Error | null = null;

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`tests/fixtures/wizzrobe/${name}.json`, "utf8"));

vi.mock("../../src/wizzrobe/tokens.js", () => ({ botAccessToken: async () => "bot-token" }));
vi.mock("../../src/wizzrobe/mcp.js", () => ({
  callTool: async (_token: string, name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (failWith) throw failWith;
    if (name === "list_stages") return fixture("list_stages");
    if (name === "list_tournaments") return fixture("list_tournaments");
    if (name === "get_schedule") return schedules[String(args.date)] ?? [];
    throw new Error(`unexpected tool ${name}`);
  },
}));
vi.mock("../../src/llm/client.js", () => {
  throw new Error("direct answers must not touch a model module");
});

type M = {
  id: number;
  tournament: string;
  scheduled_at: string;
  status: string;
  players: string[];
  stage: string;
};
const match = (id: number, stage: string, at: string, status: string, tournament: string): M => ({
  id,
  tournament,
  scheduled_at: at,
  status,
  players: [`P${id}a`, `P${id}b`],
  stage,
});
const day = (...groups: [string, M[]][]) => groups.map(([stage, matches]) => ({ stage, matches }));
const epoch = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

const TODAY = "2026-10-16";
const TOMORROW = "2026-10-17";
// Fri 2026-10-16 12:00 in New York.
const NOW = new Date("2026-10-16T16:00:00Z");

beforeEach(() => {
  calls.length = 0;
  failWith = null;
  schedules = { [TODAY]: fixture("get_schedule") };
});

const scheduleCalls = () => calls.filter((c) => c.name === "get_schedule").map((c) => c.args.date);

describe("liveAnswer", () => {
  it("shows now and next per stage, in stage order, with Discord timestamps", async () => {
    schedules[TODAY] = day(
      [
        "Earth",
        [
          match(1, "Earth", "2026-10-16T15:00:00Z", "live", "Super Mario World"),
          match(2, "Earth", "2026-10-16T17:00:00Z", "scheduled", "Mario Kart 64"),
        ],
      ],
      ["Water", [match(3, "Water", "2026-10-16T19:00:00Z", "scheduled", "Super Metroid Any%")]],
    );
    const a = await liveAnswer(NOW);
    expect(a.ephemeral).toBe(false);
    const blocks = a.text.split("\n\n");
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toBe(
      `**Earth** https://twitch.tv/SpeedGaming\nNow: P1a vs P1b (Super Mario World)\nNext: P2a vs P2b (Mario Kart 64) <t:${epoch("2026-10-16T17:00:00Z")}:t> (<t:${epoch("2026-10-16T17:00:00Z")}:R>)`,
    );
    expect(blocks[1]).toContain("**Fire** https://twitch.tv/SpeedGaming2\nNow: nothing on");
    expect(blocks[2]).toContain("Now: nothing on");
    expect(blocks[2]).toContain(`<t:${epoch("2026-10-16T19:00:00Z")}:t>`);
    expect(blocks[3]).toBe(
      "**Air** https://twitch.tv/SpeedGaming4\nNow: nothing on\nNext: nothing scheduled",
    );
  });

  it("does not fetch tomorrow when two or more matches are still upcoming today", async () => {
    await liveAnswer(NOW);
    expect(scheduleCalls()).toEqual([TODAY]);
  });

  it("fetches tomorrow when fewer than two upcoming remain today", async () => {
    schedules[TOMORROW] = day([
      "Fire",
      [match(9, "Fire", "2026-10-17T14:00:00Z", "scheduled", "Mario Kart 64")],
    ]);
    const a = await liveAnswer(new Date("2026-10-16T18:45:00Z"));
    expect(scheduleCalls()).toEqual([TODAY, TOMORROW]);
    expect(a.text).toContain(`<t:${epoch("2026-10-17T14:00:00Z")}:t>`);
  });

  it("treats checked_in and awaiting_result as on now", async () => {
    schedules[TODAY] = day(
      ["Earth", [match(1, "Earth", "2026-10-16T15:30:00Z", "awaiting_result", "Mario Kart 64")]],
      ["Fire", [match(2, "Fire", "2026-10-16T15:50:00Z", "checked_in", "Mario Kart 64")]],
    );
    const a = await liveAnswer(NOW);
    expect(a.text).toContain("Now: P1a vs P1b (Mario Kart 64)");
    expect(a.text).toContain("Now: P2a vs P2b (Mario Kart 64)");
  });

  it("propagates Wizzrobe errors", async () => {
    failWith = new WizzrobeError(502, "down");
    await expect(liveAnswer(NOW)).rejects.toBeInstanceOf(WizzrobeError);
  });
});

describe("scheduleAnswer", () => {
  it("defaults to today and groups by stage", async () => {
    const a = await scheduleAnswer({}, NOW);
    expect(scheduleCalls()).toEqual([TODAY]);
    expect(a.ephemeral).toBe(false);
    expect(a.text).toContain("**Fire**");
    expect(a.text).toContain("**Water**");
    expect(a.text).toContain(
      `<t:${epoch("2026-10-16T17:00:00Z")}:t> Player One vs Player Two (A Link to the Past Randomizer)`,
    );
  });

  it("reads a named day", async () => {
    await scheduleAnswer({ day: "tomorrow" }, NOW);
    expect(scheduleCalls()).toEqual([TOMORROW]);
  });

  it("filters by stage", async () => {
    const a = await scheduleAnswer({ stage: "water" }, NOW);
    expect(a.text).toContain("**Water**");
    expect(a.text).not.toContain("**Fire**");
  });

  it("filters by tournament", async () => {
    const a = await scheduleAnswer({ tournament: "Super Metroid Any%" }, NOW);
    expect(a.text).toContain("Player Five vs Player Six");
    expect(a.text).not.toContain("Player One");
  });

  it("says so and lists names for an unknown stage", async () => {
    const a = await scheduleAnswer({ stage: "Sky" }, NOW);
    expect(a.text).toContain("no stage");
    expect(a.text).toContain("Earth, Fire, Water, Air");
    expect(scheduleCalls()).toEqual([]);
  });

  it("offers choices for an ambiguous tournament", async () => {
    const a = await scheduleAnswer({ tournament: "super metroid" }, NOW);
    expect(a.text).toBe("Which one?");
    expect(a.choices).toEqual([
      { label: "Super Metroid Any%", value: "Super Metroid Any%" },
      { label: "Super Metroid Map Randomizer", value: "Super Metroid Map Randomizer" },
    ]);
  });

  it("says nothing is scheduled on an empty day", async () => {
    const a = await scheduleAnswer({ day: "tomorrow" }, NOW);
    const start = epoch("2026-10-17T04:00:00Z");
    expect(a.text).toBe(`Nothing is scheduled for <t:${start}:D>.`);
  });

  it("marks cancelled matches", async () => {
    schedules[TODAY] = day([
      "Fire",
      [match(5, "Fire", "2026-10-16T17:00:00Z", "cancelled", "Mario Kart 64")],
    ]);
    const a = await scheduleAnswer({}, NOW);
    expect(a.text).toContain("P5a vs P5b (Mario Kart 64) (cancelled)");
  });
});
