import { configFor } from "../config.js";
import { DiscordError } from "../errors.js";

export interface DiscordApi {
  editOriginal(token: string, body: unknown): Promise<void>;
  followup(token: string, body: unknown): Promise<void>;
  registerCommands(commands: unknown[], guildId?: string): Promise<void>;
}

const BASE_URL = "https://discord.com/api/v10";
const MAX_RETRY_WAIT_SEC = 5;

const FORBIDDEN_COMMANDS = "the app needs the applications.commands scope in this server";
const FORBIDDEN_WEBHOOK = "the bot can't post here (check View Channel and Send Messages)";

interface Credentials {
  applicationId: string;
  botToken: string;
}

interface DiscordErrorBody {
  message?: unknown;
  code?: unknown;
  retry_after?: unknown;
}

function parseBody(text: string): DiscordErrorBody {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as DiscordErrorBody) : {};
  } catch {
    return {};
  }
}

function retryAfterSec(res: Response, body: DiscordErrorBody): number | null {
  if (typeof body.retry_after === "number" && Number.isFinite(body.retry_after)) {
    return body.retry_after;
  }
  const header = res.headers.get("retry-after");
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

function failure(status: number, body: DiscordErrorBody, forbidden: string): DiscordError {
  const parts: string[] = [];
  if (status === 403) parts.push(forbidden);
  if (typeof body.message === "string" && body.message !== "") {
    const code = typeof body.code === "number" ? ` (code ${body.code})` : "";
    parts.push(`Discord said: ${body.message}${code}`);
  }
  if (parts.length === 0) parts.push(`Discord returned status ${status}`);
  return new DiscordError(status, parts.join("; "));
}

async function send(
  method: string,
  path: string,
  body: unknown,
  authorization: string | null,
  forbidden: string,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authorization !== null) headers.Authorization = authorization;
  const payload = JSON.stringify(body);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
    } catch {
      throw new DiscordError(0, "the request to Discord failed before a response arrived");
    }
    if (res.ok) return;

    const parsed = parseBody(await res.text());
    if (res.status === 429) {
      const wait = retryAfterSec(res, parsed);
      if (attempt === 0 && wait !== null && wait <= MAX_RETRY_WAIT_SEC) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, wait) * 1000));
        continue;
      }
      throw new DiscordError(429, "Discord is rate limiting this bot, try again shortly");
    }
    throw failure(res.status, parsed, forbidden);
  }
}

function realApi(): DiscordApi {
  let creds: Credentials | null = null;
  const credentials = (): Credentials => {
    if (creds === null) {
      const c = configFor("discordApplicationId", "discordBotToken");
      creds = { applicationId: c.discordApplicationId, botToken: c.discordBotToken };
    }
    return creds;
  };

  return {
    async editOriginal(token, body) {
      const { applicationId } = credentials();
      await send(
        "PATCH",
        `/webhooks/${applicationId}/${token}/messages/@original`,
        body,
        null,
        FORBIDDEN_WEBHOOK,
      );
    },
    async followup(token, body) {
      const { applicationId } = credentials();
      await send("POST", `/webhooks/${applicationId}/${token}`, body, null, FORBIDDEN_WEBHOOK);
    },
    async registerCommands(commands, guildId) {
      const { applicationId, botToken } = credentials();
      const path =
        guildId === undefined
          ? `/applications/${applicationId}/commands`
          : `/applications/${applicationId}/guilds/${guildId}/commands`;
      await send("PUT", path, commands, `Bot ${botToken}`, FORBIDDEN_COMMANDS);
    },
  };
}

let override: DiscordApi | null = null;
let real: DiscordApi | null = null;

export function discordApi(): DiscordApi {
  if (override !== null) return override;
  real ??= realApi();
  return real;
}

export function setDiscordApiForTests(d: DiscordApi | null): void {
  override = d;
}
