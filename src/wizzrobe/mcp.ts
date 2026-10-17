import { createHash } from "node:crypto";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import { WizzrobeError } from "../errors.js";
import { log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";

const SERVER_NAME = "wizzrobe";
const CONNECTOR_BETA = "mcp-client-2025-11-20";

// Read tools whose answers are safe to share briefly, in seconds. Nothing else is cached:
// writes, whoami and anything user-specific must always reach Wizzrobe.
const READ_TTL: Readonly<Record<string, number>> = {
  list_stages: 120,
  get_stage: 120,
  list_tournaments: 120,
  get_tournament: 120,
  list_randomizers: 120,
  get_schedule: 30,
  list_matches: 30,
  get_match: 30,
};

// Tools that take no tenant argument. Every other call gets the configured tenant.
const NO_TENANT = new Set(["whoami", "list_tenants"]);

const MAX_RETRY_WAIT_SEC = 10;

// Wizzrobe allows 120 requests a minute per token; stay under it for the shared bot token.
const TOKEN_RATE_LIMIT = 100;
const TOKEN_RATE_TTL_SEC = 120;

export interface RawToolResult {
  isError: boolean;
  text: string; // the tool result's text content
}

export type RawToolCall = (
  token: string,
  name: string,
  args: Record<string, unknown>,
) => Promise<RawToolResult>;

// Params for a Messages API call that lets Anthropic reach Wizzrobe with only these read tools on.
export function connectorParams(
  token: string,
  readTools: string[],
): { mcp_servers: unknown[]; tools: unknown[]; betas: string[] } {
  if (readTools.length === 0) {
    return { mcp_servers: [], tools: [], betas: [CONNECTOR_BETA] };
  }
  const configs: Record<string, { enabled: boolean }> = {};
  for (const tool of readTools) configs[tool] = { enabled: true };
  return {
    mcp_servers: [
      { type: "url", url: config().wizzrobeMcpUrl, name: SERVER_NAME, authorization_token: token },
    ],
    tools: [
      {
        type: "mcp_toolset",
        mcp_server_name: SERVER_NAME,
        default_config: { enabled: false },
        configs,
      },
    ],
    betas: [CONNECTOR_BETA],
  };
}

// Retry-After as whole seconds. The HTTP-date form is not used by Wizzrobe and is ignored.
function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const sec = Number(value.trim());
  return Number.isFinite(sec) && sec >= 0 ? sec : undefined;
}

// Turns an MCP tool result into text that parses to the value the tool returned. FastMCP (the
// Python SDK) emits one text block per list item and wraps non-object returns in
// structuredContent {"result": X}, so joining the blocks does not give JSON for lists.
export function resultText(content: unknown, structured: unknown, isError: boolean): string {
  const texts = (Array.isArray(content) ? content : []).flatMap((entry) => {
    const part = entry as { type?: unknown; text?: unknown };
    return part.type === "text" && typeof part.text === "string" ? [part.text] : [];
  });
  if (isError) return texts.join("");
  if (typeof structured === "object" && structured !== null && !Array.isArray(structured)) {
    const obj = structured as Record<string, unknown>;
    const keys = Object.keys(obj);
    return JSON.stringify(keys.length === 1 && keys[0] === "result" ? obj.result : obj);
  }
  if (texts.length === 1) return texts[0] as string;
  if (texts.length === 0) return "[]";
  try {
    return JSON.stringify(texts.map((t) => JSON.parse(t) as unknown));
  } catch {
    return texts.join("");
  }
}

// MCP SDK Client over StreamableHTTP, one connection per call (serverless: no shared state).
async function realRawToolCall(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<RawToolResult> {
  // The SDK's StreamableHTTPError carries the status but not the headers, so the transport's
  // fetch is wrapped to remember Retry-After from the last failed response.
  let retryAfterSec: number | undefined;
  const client = new Client({ name: "wizzbrew", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config().wizzrobeMcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (!response.ok) retryAfterSec = parseRetryAfter(response.headers.get("retry-after"));
      return response;
    },
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    const isError = result.isError === true;
    const text = resultText(result.content, result.structuredContent, isError);
    return { isError, text };
  } catch (err) {
    if (err instanceof WizzrobeError) throw err;
    if (err instanceof StreamableHTTPError && typeof err.code === "number" && err.code >= 100) {
      throw new WizzrobeError(err.code, err.message, retryAfterSec);
    }
    if (err instanceof UnauthorizedError) throw new WizzrobeError(401, err.message);
    throw new WizzrobeError(503, "could not reach Wizzrobe");
  } finally {
    // A failed close must not replace a good answer or the real error.
    await client.close().catch(() => undefined);
  }
}

let rawToolCall: RawToolCall = realRawToolCall;

export function setRawToolCallForTests(f: RawToolCall | null): void {
  rawToolCall = f ?? realRawToolCall;
}

// Wizzrobe reports tool failures as "<code>: <message>" text, not as HTTP statuses.
function statusForCode(code: string): number {
  const c = code.toLowerCase();
  if (c === "not_found") return 404;
  if (c === "forbidden") return 403;
  if (c === "unauthorized") return 401;
  if (c === "invalid_request") return 400;
  if (c.startsWith("rate")) return 429;
  return 500;
}

function toolError(text: string): WizzrobeError {
  const match = /^(\w+):\s*([\s\S]*)/.exec(text);
  if (!match) return new WizzrobeError(500, text);
  const [, code = "", message = ""] = match;
  return new WizzrobeError(statusForCode(code), message || text);
}

// JSON with object keys sorted at every depth, so equal args always hash alike.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => stableJson(v ?? null)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attempt(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const raw = await rawToolCall(token, name, args);
  if (raw.isError) throw toolError(raw.text);
  try {
    return JSON.parse(raw.text) as unknown;
  } catch {
    throw new WizzrobeError(502, "Wizzrobe sent a reply that isn't JSON");
  }
}

// Calls a Wizzrobe tool directly as the person who owns `token`. The tenant always comes from
// config, never from the caller. A 429 is retried once.
export async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const started = Date.now();
  const callArgs = NO_TENANT.has(name) ? args : { ...args, tenant: config().wizzrobeTenant };
  const ttl = READ_TTL[name];
  const cacheKey =
    ttl === undefined
      ? null
      : keys.cache("mcp", sha256hex(`${token}\n${name}\n${stableJson(callArgs)}`));

  try {
    if (cacheKey !== null) {
      const hit = await kv().get<{ value: unknown }>(cacheKey);
      if (hit !== null) {
        log("info", "wizzrobe.tool", { name, ok: true, ms: Date.now() - started, cached: true });
        return hit.value;
      }
    }

    const minute = Math.floor(Date.now() / 60000);
    const used = await kv().incrByFloat(
      keys.cache("tokrate", `${sha256hex(token).slice(0, 16)}-${minute}`),
      1,
      TOKEN_RATE_TTL_SEC,
    );
    if (used > TOKEN_RATE_LIMIT) {
      throw new WizzrobeError(429, "too many Wizzrobe requests this minute", 30);
    }

    let value: unknown;
    try {
      value = await attempt(token, name, callArgs);
    } catch (err) {
      if (!(err instanceof WizzrobeError) || err.status !== 429) throw err;
      await sleep(Math.min(err.retryAfterSec ?? 1, MAX_RETRY_WAIT_SEC) * 1000);
      value = await attempt(token, name, callArgs);
    }

    if (cacheKey !== null && ttl !== undefined) await kv().set(cacheKey, { value }, ttl);
    log("info", "wizzrobe.tool", { name, ok: true, ms: Date.now() - started, cached: false });
    return value;
  } catch (err) {
    log("info", "wizzrobe.tool", { name, ok: false, ms: Date.now() - started, cached: false });
    throw err;
  }
}
