import { beforeEach } from "vitest";
import { resetConfigForTests } from "../src/config.js";

// Obviously fake values that match no secret shape. Every variable, optional ones too.
const DUMMY_ENV: Record<string, string> = {
  ANTHROPIC_API_KEY: "test-anthropic-key",
  ANTHROPIC_DAILY_BUDGET_USD: "25",
  DISCORD_APPLICATION_ID: "test-application-id",
  DISCORD_PUBLIC_KEY: "0".repeat(64),
  DISCORD_BOT_TOKEN: "test-bot-token",
  DISCORD_CLIENT_SECRET: "test-discord-client-secret",
  DISCORD_OAUTH_REDIRECT_URI: "https://bot.test/api/oauth/discord",
  DISCORD_DEV_GUILD_ID: "test-dev-guild-id",
  SAFE_DEFAULT_CHANNEL_ID: "test-safe-channel-id",
  WIZZROBE_BASE_URL: "https://wizzrobe.test",
  WIZZROBE_MCP_URL: "https://wizzrobe.test/mcp",
  WIZZROBE_TENANT: "sgl26",
  WIZZROBE_OAUTH_CLIENT_ID: "test-oauth-client-id",
  WIZZROBE_OAUTH_CLIENT_SECRET: "test-oauth-client-secret",
  WIZZROBE_OAUTH_REDIRECT_URI: "https://bot.test/api/oauth/callback",
  WIZZROBE_BOT_REFRESH_TOKEN: "test-bot-refresh-token",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  KV_REST_API_URL: "https://kv.test",
  KV_REST_API_TOKEN: "test-kv-token",
  COMMUNITY_TIMEZONE: "America/New_York",
  CHALLONGE_API_KEY: "test-challonge-key",
  RELAY_SECRET: "test-relay-value-not-real-".padEnd(40, "x"),
  STAFF_ALERT_CHANNEL_ID: "test-staff-alert-channel-id",
};

for (const [name, value] of Object.entries(DUMMY_ENV)) {
  process.env[name] = value;
}

beforeEach(() => {
  resetConfigForTests();
});
