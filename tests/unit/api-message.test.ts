import { createHmac } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../api/message.js";
import { runMessagePipeline } from "../../src/handlers/message.js";
import { isPaused } from "../../src/ops/alerts.js";

const SECRET = "s".repeat(40);

vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
vi.mock("../../src/handlers/message.js", () => ({ runMessagePipeline: vi.fn() }));
vi.mock("../../src/ops/alerts.js", () => ({ isPaused: vi.fn() }));
vi.mock("../../src/config.js", () => ({ config: () => ({ relaySecret: "s".repeat(40) }) }));

function body(chainLen = 1): string {
  return JSON.stringify({
    messageId: "m",
    channelId: "c",
    guildId: null,
    isDm: true,
    author: { id: "1", username: "u", globalName: null, nick: null },
    content: "hi",
    chain: Array.from({ length: chainLen }, () => ({
      authorId: "2",
      authorName: "x",
      isBot: false,
      content: "y",
    })),
  });
}

function sign(raw: string, ts: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
}

function req(raw: string, headers: Record<string, string>): Request {
  return new Request("https://x.test/api/message", { method: "POST", body: raw, headers });
}

function signed(raw: string, over: { ts?: string; secret?: string } = {}): Request {
  const ts = over.ts ?? String(Math.floor(Date.now() / 1000));
  return req(raw, {
    "X-Relay-Timestamp": ts,
    "X-Relay-Signature": sign(raw, ts, over.secret),
  });
}

beforeEach(() => {
  vi.mocked(waitUntil).mockReset();
  vi.mocked(runMessagePipeline).mockReset().mockResolvedValue(undefined);
  vi.mocked(isPaused).mockReset().mockResolvedValue(false);
});

describe("POST /api/message", () => {
  it("accepts a valid signature with 202 and runs the pipeline in waitUntil", async () => {
    const res = await POST(signed(body()));
    expect(res.status).toBe(202);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(runMessagePipeline).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong secret", async () => {
    expect((await POST(signed(body(), { secret: "z".repeat(40) }))).status).toBe(401);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("rejects an old timestamp", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 400);
    expect((await POST(signed(body(), { ts }))).status).toBe(401);
  });

  it("rejects missing headers", async () => {
    expect((await POST(req(body(), {}))).status).toBe(401);
  });

  it("rejects bad JSON with 400", async () => {
    expect((await POST(signed("not json"))).status).toBe(400);
  });

  it("rejects a chain of 11 with 400", async () => {
    expect((await POST(signed(body(11)))).status).toBe(400);
    expect((await POST(signed(body(10)))).status).toBe(202);
  });

  it("answers 200 paused without running anything", async () => {
    vi.mocked(isPaused).mockResolvedValue(true);
    const res = await POST(signed(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ paused: true });
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
