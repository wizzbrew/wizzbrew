import { afterEach, describe, expect, it, vi } from "vitest";
import { checkConfig, config, configFor, resetConfigForTests } from "../../src/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function thrownText(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error("expected the call to throw");
}

describe("config()", () => {
  it("passes with a valid environment", () => {
    const c = config();
    expect(c.anthropicApiKey).toBe("test-anthropic-key");
    expect(c.anthropicDailyBudgetUsd).toBe(25);
    expect(c.discordPublicKey).toBe("0".repeat(64));
    expect(c.wizzrobeMcpUrl).toBe("https://wizzrobe.test/mcp");
    expect(c.wizzrobeTenant).toBe("sgl26");
    expect(c.communityTimezone).toBe("America/New_York");
    expect(c.discordDevGuildId).toBe("test-dev-guild-id");
    expect(c.challongeApiKey).toBe("test-challonge-key");
  });

  it("caches after the first call and re-reads after a reset", () => {
    expect(config().wizzrobeTenant).toBe("sgl26");
    vi.stubEnv("WIZZROBE_TENANT", "other");
    expect(config().wizzrobeTenant).toBe("sgl26");
    resetConfigForTests();
    expect(config().wizzrobeTenant).toBe("other");
  });

  it("throws naming a missing required variable", () => {
    vi.stubEnv("KV_REST_API_URL", undefined);
    expect(thrownText(() => config())).toBe("Config error: KV_REST_API_URL is missing");
  });

  it("treats an empty required variable as missing", () => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "");
    expect(thrownText(() => config())).toContain("DISCORD_BOT_TOKEN is missing");
  });

  it("joins every problem with a semicolon", () => {
    vi.stubEnv("KV_REST_API_URL", undefined);
    vi.stubEnv("DISCORD_PUBLIC_KEY", "not-a-key");
    expect(thrownText(() => config())).toBe(
      "Config error: DISCORD_PUBLIC_KEY must be 64 hex characters; KV_REST_API_URL is missing",
    );
  });

  const badValues: { env: string; value: string; rule: string }[] = [
    { env: "DISCORD_PUBLIC_KEY", value: "bad-hex-value-1234", rule: "64 hex characters" },
    {
      env: "TOKEN_ENCRYPTION_KEY",
      value: Buffer.alloc(16, 7).toString("base64"),
      rule: "exactly 32 bytes",
    },
    { env: "TOKEN_ENCRYPTION_KEY", value: "not base64 at all!!", rule: "exactly 32 bytes" },
    { env: "COMMUNITY_TIMEZONE", value: "Mars/Olympus_Mons", rule: "IANA time zone" },
    { env: "ANTHROPIC_DAILY_BUDGET_USD", value: "plenty", rule: "positive number" },
    { env: "ANTHROPIC_DAILY_BUDGET_USD", value: "0", rule: "positive number" },
    { env: "ANTHROPIC_DAILY_BUDGET_USD", value: "-3", rule: "positive number" },
    { env: "WIZZROBE_BASE_URL", value: "http://insecure.example", rule: "https URL" },
    { env: "WIZZROBE_MCP_URL", value: "not a url", rule: "https URL" },
    { env: "WIZZROBE_OAUTH_REDIRECT_URI", value: "ftp://redirect.example", rule: "https URL" },
    { env: "KV_REST_API_URL", value: "kv-host-without-scheme", rule: "https URL" },
  ];

  it.each(badValues)(
    "rejects a bad $env ($value) naming the variable and rule",
    ({ env, value, rule }) => {
      vi.stubEnv(env, value);
      const text = thrownText(() => config());
      expect(text).toContain(`${env} must be`);
      expect(text).toContain(rule);
      expect(text).not.toContain(value);
    },
  );

  it("never echoes a bad value in any problem text", () => {
    const secretish = "zz-looks-like-a-secret-value-zz";
    vi.stubEnv("DISCORD_PUBLIC_KEY", secretish);
    vi.stubEnv("COMMUNITY_TIMEZONE", secretish);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", secretish);
    vi.stubEnv("KV_REST_API_URL", secretish);
    vi.stubEnv("ANTHROPIC_DAILY_BUDGET_USD", secretish);
    expect(thrownText(() => config())).not.toContain(secretish);
    for (const problem of checkConfig().problems) expect(problem).not.toContain(secretish);
  });

  it("treats an empty or unset optional variable as null", () => {
    vi.stubEnv("DISCORD_DEV_GUILD_ID", "");
    vi.stubEnv("SAFE_DEFAULT_CHANNEL_ID", undefined);
    vi.stubEnv("CHALLONGE_API_KEY", "");
    const c = config();
    expect(c.discordDevGuildId).toBeNull();
    expect(c.safeDefaultChannelId).toBeNull();
    expect(c.challongeApiKey).toBeNull();
  });
});

describe("OWNER_DISCORD_IDS and DM_DAILY_LIMIT", () => {
  it("reads the owner ids as a trimmed list", () => {
    vi.stubEnv("OWNER_DISCORD_IDS", " 111111111111111111 ,222222222222222222,");
    expect(config().ownerDiscordIds).toEqual(["111111111111111111", "222222222222222222"]);
  });

  it("reads one owner id", () => {
    vi.stubEnv("OWNER_DISCORD_IDS", "111111111111111111");
    expect(config().ownerDiscordIds).toEqual(["111111111111111111"]);
  });

  it("treats an unset, empty or all comma owner list as nobody", () => {
    vi.stubEnv("OWNER_DISCORD_IDS", undefined);
    expect(config().ownerDiscordIds).toEqual([]);
    resetConfigForTests();
    vi.stubEnv("OWNER_DISCORD_IDS", "");
    expect(config().ownerDiscordIds).toEqual([]);
    resetConfigForTests();
    vi.stubEnv("OWNER_DISCORD_IDS", " , ,");
    expect(config().ownerDiscordIds).toEqual([]);
  });

  it.each(["vince", "111111111111111111,vince", "<@111111111111111111>", "1.5", "-1"])(
    "rejects the owner list %s loudly, without echoing it",
    (value) => {
      vi.stubEnv("OWNER_DISCORD_IDS", value);
      const text = thrownText(() => config());
      expect(text).toContain(
        "OWNER_DISCORD_IDS must be a comma-separated list of Discord user ids",
      );
      expect(text).not.toContain(value);
    },
  );

  it("reads DM_DAILY_LIMIT as a whole number", () => {
    vi.stubEnv("DM_DAILY_LIMIT", "12");
    expect(config().dmDailyLimit).toBe(12);
  });

  it("defaults DM_DAILY_LIMIT to 5 when unset or empty", () => {
    vi.stubEnv("DM_DAILY_LIMIT", undefined);
    expect(config().dmDailyLimit).toBe(5);
    resetConfigForTests();
    vi.stubEnv("DM_DAILY_LIMIT", "");
    expect(config().dmDailyLimit).toBe(5);
  });

  it.each(["0", "-3", "2.5", "many", "5 or so"])("rejects DM_DAILY_LIMIT=%s loudly", (value) => {
    vi.stubEnv("DM_DAILY_LIMIT", value);
    const text = thrownText(() => config());
    expect(text).toContain("DM_DAILY_LIMIT must be a positive whole number");
    expect(text).not.toContain(value);
  });

  it("checkConfig reports both as problems and stays valid when they are unset", () => {
    vi.stubEnv("DM_DAILY_LIMIT", "0");
    vi.stubEnv("OWNER_DISCORD_IDS", "nope");
    expect(checkConfig().problems).toEqual([
      "OWNER_DISCORD_IDS must be a comma-separated list of Discord user ids (digits only)",
      "DM_DAILY_LIMIT must be a positive whole number",
    ]);
    vi.stubEnv("DM_DAILY_LIMIT", undefined);
    vi.stubEnv("OWNER_DISCORD_IDS", undefined);
    expect(checkConfig()).toEqual({ valid: true, problems: [] });
  });

  it("configFor reads just these two keys", () => {
    vi.stubEnv("KV_REST_API_URL", undefined);
    vi.stubEnv("DM_DAILY_LIMIT", "9");
    expect(configFor("ownerDiscordIds", "dmDailyLimit")).toEqual({
      ownerDiscordIds: ["100000000000000001", "100000000000000002"],
      dmDailyLimit: 9,
    });
  });
});

describe("configFor()", () => {
  it("validates only the requested keys", () => {
    vi.stubEnv("KV_REST_API_URL", undefined);
    const c = configFor("anthropicApiKey", "wizzrobeTenant");
    expect(c).toEqual({ anthropicApiKey: "test-anthropic-key", wizzrobeTenant: "sgl26" });
  });

  it("throws for a requested key that is bad, naming only that problem", () => {
    vi.stubEnv("KV_REST_API_URL", undefined);
    vi.stubEnv("DISCORD_PUBLIC_KEY", "nope");
    expect(thrownText(() => configFor("kvRestApiUrl"))).toBe(
      "Config error: KV_REST_API_URL is missing",
    );
  });

  it("returns null for an unset optional key", () => {
    vi.stubEnv("CHALLONGE_API_KEY", undefined);
    expect(configFor("challongeApiKey")).toEqual({ challongeApiKey: null });
  });

  it("does not cache", () => {
    expect(configFor("wizzrobeTenant").wizzrobeTenant).toBe("sgl26");
    vi.stubEnv("WIZZROBE_TENANT", "other");
    expect(configFor("wizzrobeTenant").wizzrobeTenant).toBe("other");
  });
});

describe("checkConfig()", () => {
  it("is valid with a good environment", () => {
    expect(checkConfig()).toEqual({ valid: true, problems: [] });
  });

  it("lists problems without throwing", () => {
    vi.stubEnv("KV_REST_API_URL", undefined);
    vi.stubEnv("COMMUNITY_TIMEZONE", "Nowhere/Land");
    const result = checkConfig();
    expect(result.valid).toBe(false);
    expect(result.problems).toEqual([
      "KV_REST_API_URL is missing",
      "COMMUNITY_TIMEZONE must be an IANA time zone name",
    ]);
  });
});

describe("discord oauth config", () => {
  it("reads the client secret and redirect", () => {
    const c = config();
    expect(c.discordClientSecret).toBe("test-discord-client-secret");
    expect(c.discordOauthRedirectUri).toBe("https://bot.test/api/oauth/discord");
  });

  it("requires DISCORD_CLIENT_SECRET", () => {
    vi.stubEnv("DISCORD_CLIENT_SECRET", undefined);
    expect(thrownText(() => config())).toBe("Config error: DISCORD_CLIENT_SECRET is missing");
  });

  it("rejects a non-https DISCORD_OAUTH_REDIRECT_URI", () => {
    vi.stubEnv("DISCORD_OAUTH_REDIRECT_URI", "http://bot.test/api/oauth/discord");
    expect(thrownText(() => config())).toBe(
      "Config error: DISCORD_OAUTH_REDIRECT_URI must be a valid https URL",
    );
  });
});

describe("relay config", () => {
  it("reads the relay secret and staff alert channel", () => {
    const c = config();
    expect(c.relaySecret.length).toBeGreaterThanOrEqual(32);
    expect(c.staffAlertChannelId).toBe("test-staff-alert-channel-id");
  });

  it("requires RELAY_SECRET", () => {
    vi.stubEnv("RELAY_SECRET", undefined);
    expect(thrownText(() => config())).toBe("Config error: RELAY_SECRET is missing");
  });

  it("rejects a short RELAY_SECRET without echoing it", () => {
    vi.stubEnv("RELAY_SECRET", "short-value");
    const msg = thrownText(() => config());
    expect(msg).toBe("Config error: RELAY_SECRET must be at least 32 characters");
    expect(msg).not.toContain("short-value");
  });

  it("treats an empty STAFF_ALERT_CHANNEL_ID as absent", () => {
    vi.stubEnv("STAFF_ALERT_CHANNEL_ID", "");
    expect(config().staffAlertChannelId).toBeNull();
  });
});
