import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const waitUntilSpy = vi.hoisted(() => vi.fn());
vi.mock("@vercel/functions", () => ({ waitUntil: waitUntilSpy }));
vi.mock("../../src/handlers/dispatch.js", () => ({ handleInteraction: vi.fn() }));

import { GET } from "../../api/health.js";
import { POST } from "../../api/interactions.js";
import { resetConfigForTests } from "../../src/config.js";
import { handleInteraction } from "../../src/handlers/dispatch.js";

const handler = vi.mocked(handleInteraction);
let privateKey: CryptoKey;
let publicHex: string;

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
  };
  privateKey = pair.privateKey;
  publicHex = hex(await crypto.subtle.exportKey("raw", pair.publicKey));
});

beforeEach(() => {
  vi.stubEnv("DISCORD_PUBLIC_KEY", publicHex);
  resetConfigForTests();
  handler.mockReset();
  waitUntilSpy.mockReset();
});

async function signed(body: string, tamper = false): Promise<Request> {
  const timestamp = "1700000000";
  const sig = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(timestamp + body),
  );
  return new Request("https://example.test/api/interactions", {
    method: "POST",
    headers: {
      "X-Signature-Ed25519": tamper ? "00".repeat(64) : hex(sig),
      "X-Signature-Timestamp": timestamp,
    },
    body,
  });
}

describe("POST /api/interactions", () => {
  it("rejects a bad signature with 401 and does not dispatch", async () => {
    const res = await POST(await signed(JSON.stringify({ type: 2 }), true));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects missing headers with 401", async () => {
    const res = await POST(new Request("https://example.test/", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers a signed PING with type 1", async () => {
    const res = await POST(await signed(JSON.stringify({ type: 1 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("hands a command to the dispatcher and returns its response", async () => {
    const body = { type: 2, id: "1", data: { name: "ask" } };
    const out = new Response("from dispatch", { status: 200 });
    handler.mockResolvedValue(out);
    const res = await POST(await signed(JSON.stringify(body)));
    expect(res).toBe(out);
    expect(handler).toHaveBeenCalledWith(body, waitUntilSpy);
  });

  it("returns 400 for malformed JSON with a valid signature", async () => {
    const res = await POST(await signed("{not json"));
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("GET /api/health", () => {
  it("reports shape and valid config without leaking env", async () => {
    const res = await GET(new Request("https://example.test/api/health"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const text = await res.text();
    const json = JSON.parse(text);
    expect(json.ok).toBe(true);
    expect(json.configValid).toBe(true);
    expect(Array.isArray(json.routes)).toBe(true);
    expect(text).not.toContain(publicHex);
    expect(text).not.toContain("test-anthropic-key");
    expect(text).not.toContain("DISCORD");
  });
});
