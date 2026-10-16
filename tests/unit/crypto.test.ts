import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../../src/config.js";
import { open, seal } from "../../src/store/crypto.js";

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

// config() validates every variable, so each test sets the full valid set and only the
// token key varies.
function stubConfigEnv(tokenKey: string): void {
  const env: Record<string, string> = {
    ANTHROPIC_API_KEY: "test-anthropic-key",
    ANTHROPIC_DAILY_BUDGET_USD: "1",
    DISCORD_APPLICATION_ID: "123456789012345678",
    DISCORD_PUBLIC_KEY: "00".repeat(32),
    DISCORD_BOT_TOKEN: "test-bot-token",
    WIZZROBE_BASE_URL: "https://wizzrobe.example.test",
    WIZZROBE_MCP_URL: "https://wizzrobe.example.test/mcp",
    WIZZROBE_TENANT: "sgl26",
    WIZZROBE_OAUTH_CLIENT_ID: "test-client-id",
    WIZZROBE_OAUTH_CLIENT_SECRET: "test-client-secret",
    WIZZROBE_OAUTH_REDIRECT_URI: "https://wizzbrew.example.test/api/oauth/callback",
    WIZZROBE_BOT_REFRESH_TOKEN: "test-refresh-token",
    TOKEN_ENCRYPTION_KEY: tokenKey,
    KV_REST_API_URL: "https://kv.example.test",
    KV_REST_API_TOKEN: "test-kv-token",
    COMMUNITY_TIMEZONE: "America/New_York",
  };
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
  resetConfigForTests();
}

describe("crypto", () => {
  beforeEach(() => {
    stubConfigEnv(KEY_A);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfigForTests();
  });

  it("round-trips plaintext", async () => {
    const sealed = await seal("refresh-token-value");
    await expect(open(sealed)).resolves.toBe("refresh-token-value");
  });

  it("round-trips non-ASCII text", async () => {
    const sealed = await seal("ünïcode ✓");
    await expect(open(sealed)).resolves.toBe("ünïcode ✓");
  });

  it("seals the same text to different values", async () => {
    const first = await seal("same");
    const second = await seal("same");
    expect(first).not.toBe(second);
    await expect(open(first)).resolves.toBe("same");
    await expect(open(second)).resolves.toBe("same");
  });

  it("writes base64(iv) . base64(ciphertext) with a 12 byte iv", async () => {
    const [iv = "", body = ""] = (await seal("x")).split(".");
    expect(Buffer.from(iv, "base64")).toHaveLength(12);
    expect(body.length).toBeGreaterThan(0);
  });

  it("throws when one character of the ciphertext is flipped", async () => {
    const [iv = "", body = ""] = (await seal("secret")).split(".");
    const flipped = `${body.charAt(0) === "A" ? "B" : "A"}${body.slice(1)}`;
    await expect(open(`${iv}.${flipped}`)).rejects.toThrow("sealed value is invalid");
  });

  it("throws when the configured key differs from the sealing key", async () => {
    const sealed = await seal("secret");
    stubConfigEnv(KEY_B);
    await expect(open(sealed)).rejects.toThrow("sealed value is invalid");
  });

  it.each(["", "nodot", "a.b.c", ".abc", "abc.", "AAAA.AAAA", "!!!.???"])(
    "throws on garbage input %j",
    async (input) => {
      await expect(open(input)).rejects.toThrow("sealed value is invalid");
    },
  );
});
