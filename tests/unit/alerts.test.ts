import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../../src/config.js";
import { setDiscordApiForTests } from "../../src/discord/api.js";
import { alertStaff, isPaused } from "../../src/ops/alerts.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { FakeDiscordApi } from "../fakes/discord.js";
import { FakeKv } from "../fakes/kv.js";

let now: number;
let fakeKv: FakeKv;
let discord: FakeDiscordApi;

beforeEach(() => {
  now = Date.parse("2026-10-15T12:00:00Z");
  fakeKv = new FakeKv(() => now);
  discord = new FakeDiscordApi();
  setKvForTests(fakeKv);
  setDiscordApiForTests(discord);
  vi.stubEnv("STAFF_ALERT_CHANNEL_ID", "chan-1");
  resetConfigForTests();
  vi.spyOn(console, "log").mockImplementation(vi.fn());
  vi.spyOn(console, "error").mockImplementation(vi.fn());
});

afterEach(() => {
  setKvForTests(null);
  setDiscordApiForTests(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetConfigForTests();
});

describe("alertStaff", () => {
  it("posts once, then again after 10 minutes", async () => {
    await alertStaff("mcp.down", "boom");
    await alertStaff("mcp.down", "boom");
    expect(discord.calls).toHaveLength(1);
    now += 601_000;
    await alertStaff("mcp.down", "boom");
    expect(discord.calls).toHaveLength(2);
    expect(discord.calls[0]?.body).toEqual({
      channelId: "chan-1",
      replyToMessageId: undefined,
      body: { content: "Wizzbrew alert: mcp.down\nboom", allowed_mentions: { parse: [] } },
    });
  });

  it("posts nothing without a channel", async () => {
    vi.stubEnv("STAFF_ALERT_CHANNEL_ID", "");
    resetConfigForTests();
    await alertStaff("mcp.down", "boom");
    expect(discord.calls).toHaveLength(0);
  });

  it("does not throw when Discord fails", async () => {
    discord.failNext(new Error("discord down"));
    await expect(alertStaff("mcp.down", "boom")).resolves.toBeUndefined();
  });

  it("normalizes the event and clips the detail", async () => {
    await alertStaff("Bad Event!", "x".repeat(1000));
    const call = discord.calls[0]?.body as { body: { content: string } };
    expect(call.body.content.startsWith("Wizzbrew alert: bad_event_\n")).toBe(true);
    expect(call.body.content.length).toBeLessThan(350);
  });
});

describe("isPaused", () => {
  it("is false without the key and true with it", async () => {
    expect(await isPaused()).toBe(false);
    await fakeKv.set(keys.kill(), 1);
    expect(await isPaused()).toBe(true);
  });
});
