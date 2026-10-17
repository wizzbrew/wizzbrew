import { z } from "zod";

// The only module in src/ that reads process.env. Messages built here name the env var and the
// rule, never the value and never a zod message (a zod message could echo the value).

export interface Config {
  anthropicApiKey: string; // ANTHROPIC_API_KEY
  anthropicDailyBudgetUsd: number; // ANTHROPIC_DAILY_BUDGET_USD, positive
  discordApplicationId: string; // DISCORD_APPLICATION_ID
  discordPublicKey: string; // DISCORD_PUBLIC_KEY, 64 hex chars
  discordBotToken: string; // DISCORD_BOT_TOKEN
  discordClientSecret: string; // DISCORD_CLIENT_SECRET (Discord app OAuth2)
  discordOauthRedirectUri: string; // DISCORD_OAUTH_REDIRECT_URI, https://<domain>/api/oauth/discord
  discordDevGuildId: string | null; // DISCORD_DEV_GUILD_ID, optional
  safeDefaultChannelId: string | null; // SAFE_DEFAULT_CHANNEL_ID, optional (L20)
  wizzrobeBaseUrl: string; // WIZZROBE_BASE_URL, e.g. https://wizzrobe.synack.live
  wizzrobeMcpUrl: string; // WIZZROBE_MCP_URL, e.g. https://wizzrobe.synack.live/mcp
  wizzrobeTenant: string; // WIZZROBE_TENANT, sgl26
  wizzrobeOauthClientId: string; // WIZZROBE_OAUTH_CLIENT_ID
  wizzrobeOauthClientSecret: string; // WIZZROBE_OAUTH_CLIENT_SECRET
  wizzrobeOauthRedirectUri: string; // WIZZROBE_OAUTH_REDIRECT_URI, https://<domain>/api/oauth/callback
  wizzrobeBotRefreshToken: string; // WIZZROBE_BOT_REFRESH_TOKEN
  tokenEncryptionKey: string; // TOKEN_ENCRYPTION_KEY, base64 of exactly 32 bytes
  kvRestApiUrl: string; // KV_REST_API_URL (injected by the Vercel Upstash integration)
  kvRestApiToken: string; // KV_REST_API_TOKEN (same)
  communityTimezone: string; // COMMUNITY_TIMEZONE, IANA zone, e.g. America/New_York
  challongeApiKey: string | null; // CHALLONGE_API_KEY, optional
  relaySecret: string; // RELAY_SECRET, at least 32 chars, shared with the relay
  staffAlertChannelId: string | null; // STAFF_ALERT_CHANNEL_ID, optional
  ownerDiscordIds: string[]; // OWNER_DISCORD_IDS, optional comma-separated Discord user ids; empty means nobody
  dmDailyLimit: number; // DM_DAILY_LIMIT, optional positive integer, default 5
  matcherinoBountyId: string | null; // MATCHERINO_BOUNTY_ID, optional, digits only; empty turns the prize pool line off
}

interface VarSpec<T> {
  env: string;
  rule: string; // finishes the sentence "<ENV> must be ..."
  optional: boolean;
  fallback?: () => T; // what an optional variable reads as when unset, instead of null
  schema: z.ZodType<T, unknown>;
}

type Specs = { [K in keyof Config]: VarSpec<NonNullable<Config[K]>> };

const nonEmpty = z.string().min(1);

const httpsUrl = z.string().refine((v) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
});

const publicKey = z.string().regex(/^[0-9a-fA-F]{64}$/);

const base64Key32 = z.string().refine((v) => {
  if (v.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
  return Buffer.from(v, "base64").length === 32;
});

const DISCORD_ID_LIST_ITEM = /^\d+$/;

// "123, 456," becomes ["123", "456"]: items are trimmed and empty items (a stray comma) dropped.
// Any item that is not all digits fails the whole value.
const discordIdList = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== ""),
  )
  .refine((items) => items.every((item) => DISCORD_ID_LIST_ITEM.test(item)));

const digitsOnly = z.string().regex(/^\d+$/);

const ianaZone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
});

const required = <T>(env: string, rule: string, schema: z.ZodType<T>): VarSpec<T> => ({
  env,
  rule,
  optional: false,
  schema,
});

const optionalVar = <T>(env: string, rule: string, schema: z.ZodType<T>): VarSpec<T> => ({
  env,
  rule,
  optional: true,
  schema,
});

const optionalWithDefault = <T>(
  env: string,
  rule: string,
  schema: z.ZodType<T, unknown>,
  fallback: () => T,
): VarSpec<T> => ({
  env,
  rule,
  optional: true,
  fallback,
  schema,
});

const SPECS: Specs = {
  anthropicApiKey: required("ANTHROPIC_API_KEY", "a non-empty string", nonEmpty),
  anthropicDailyBudgetUsd: required(
    "ANTHROPIC_DAILY_BUDGET_USD",
    "a positive number",
    z.coerce.number().positive(),
  ),
  discordApplicationId: required("DISCORD_APPLICATION_ID", "a non-empty string", nonEmpty),
  discordPublicKey: required("DISCORD_PUBLIC_KEY", "64 hex characters", publicKey),
  discordBotToken: required("DISCORD_BOT_TOKEN", "a non-empty string", nonEmpty),
  discordClientSecret: required("DISCORD_CLIENT_SECRET", "a non-empty string", nonEmpty),
  discordOauthRedirectUri: required("DISCORD_OAUTH_REDIRECT_URI", "a valid https URL", httpsUrl),
  discordDevGuildId: optionalVar("DISCORD_DEV_GUILD_ID", "a non-empty string", nonEmpty),
  safeDefaultChannelId: optionalVar("SAFE_DEFAULT_CHANNEL_ID", "a non-empty string", nonEmpty),
  wizzrobeBaseUrl: required("WIZZROBE_BASE_URL", "a valid https URL", httpsUrl),
  wizzrobeMcpUrl: required("WIZZROBE_MCP_URL", "a valid https URL", httpsUrl),
  wizzrobeTenant: required("WIZZROBE_TENANT", "a non-empty string", nonEmpty),
  wizzrobeOauthClientId: required("WIZZROBE_OAUTH_CLIENT_ID", "a non-empty string", nonEmpty),
  wizzrobeOauthClientSecret: required(
    "WIZZROBE_OAUTH_CLIENT_SECRET",
    "a non-empty string",
    nonEmpty,
  ),
  wizzrobeOauthRedirectUri: required("WIZZROBE_OAUTH_REDIRECT_URI", "a valid https URL", httpsUrl),
  wizzrobeBotRefreshToken: required("WIZZROBE_BOT_REFRESH_TOKEN", "a non-empty string", nonEmpty),
  tokenEncryptionKey: required(
    "TOKEN_ENCRYPTION_KEY",
    "base64 that decodes to exactly 32 bytes",
    base64Key32,
  ),
  kvRestApiUrl: required("KV_REST_API_URL", "a valid https URL", httpsUrl),
  kvRestApiToken: required("KV_REST_API_TOKEN", "a non-empty string", nonEmpty),
  communityTimezone: required("COMMUNITY_TIMEZONE", "an IANA time zone name", ianaZone),
  challongeApiKey: optionalVar("CHALLONGE_API_KEY", "a non-empty string", nonEmpty),
  relaySecret: required("RELAY_SECRET", "at least 32 characters", z.string().min(32)),
  staffAlertChannelId: optionalVar("STAFF_ALERT_CHANNEL_ID", "a non-empty string", nonEmpty),
  ownerDiscordIds: optionalWithDefault(
    "OWNER_DISCORD_IDS",
    "a comma-separated list of Discord user ids (digits only)",
    discordIdList,
    () => [],
  ),
  dmDailyLimit: optionalWithDefault(
    "DM_DAILY_LIMIT",
    "a positive whole number",
    z.coerce.number().int().positive(),
    () => 5,
  ),
  matcherinoBountyId: optionalVar("MATCHERINO_BOUNTY_ID", "digits only", digitsOnly),
};

const ALL_KEYS = Object.keys(SPECS) as (keyof Config)[];

type VarResult<K extends keyof Config> =
  | { ok: true; value: Config[K] }
  | { ok: false; problem: string };

function readVar<K extends keyof Config>(key: K): VarResult<K> {
  const spec = SPECS[key];
  const raw = process.env[spec.env];
  if (raw === undefined || raw === "") {
    if (spec.fallback) return { ok: true, value: spec.fallback() as Config[K] };
    if (spec.optional) return { ok: true, value: null as Config[K] };
    return { ok: false, problem: `${spec.env} is missing` };
  }
  const parsed = spec.schema.safeParse(raw);
  if (!parsed.success) return { ok: false, problem: `${spec.env} must be ${spec.rule}` };
  return { ok: true, value: parsed.data as Config[K] };
}

function readKeys<K extends keyof Config>(
  keys: readonly K[],
): { values: Partial<Pick<Config, K>>; problems: string[] } {
  const values: Partial<Pick<Config, K>> = {};
  const problems: string[] = [];
  for (const key of keys) {
    const r = readVar(key);
    if (r.ok) values[key] = r.value;
    else problems.push(r.problem);
  }
  return { values, problems };
}

function failWith(problems: string[]): never {
  throw new Error(`Config error: ${problems.join("; ")}`);
}

let cached: Config | null = null;

export function config(): Config {
  if (cached) return cached;
  const { values, problems } = readKeys(ALL_KEYS);
  if (problems.length > 0) failWith(problems);
  cached = values as Config;
  return cached;
}

export function configFor<K extends keyof Config>(...keys: K[]): Pick<Config, K> {
  const { values, problems } = readKeys(keys);
  if (problems.length > 0) failWith(problems);
  return values as Pick<Config, K>;
}

export function checkConfig(): { valid: boolean; problems: string[] } {
  const { problems } = readKeys(ALL_KEYS);
  return { valid: problems.length === 0, problems };
}

export function resetConfigForTests(): void {
  cached = null;
}
