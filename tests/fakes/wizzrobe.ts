import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RawToolCall } from "../../src/wizzrobe/mcp.js";
import { requestUrl } from "./fetch.js";

const FIXTURES = new URL("../fixtures/wizzrobe/", import.meta.url);

const FEATURE_TOOL = /bracket|qualifier|race_room/;

const WRITE_TOOLS = new Set([
  "signup_as_crew",
  "withdraw_crew_signup",
  "acknowledge_match",
  "offer_match_for_stream",
  "withdraw_stream_offer",
  "watch_match",
  "unwatch_match",
  "sign_up_for_tournament",
  "withdraw_from_tournament",
  "submit_match_request",
  "suggest_match_time",
]);

// Reads a fixture and drops the top-level `_note`. Undefined when the file does not exist.
function readFixture(name: string): unknown {
  if (!/^[A-Za-z0-9_]+$/.test(name)) return undefined;
  const path = fileURLToPath(new URL(`${name}.json`, FIXTURES));
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const { _note: _dropped, ...rest } = parsed as Record<string, unknown>;
    return rest;
  }
  return parsed;
}

function requireFixture(name: string): unknown {
  const fixture = readFixture(name);
  if (fixture === undefined) throw new Error(`FakeWizzrobe: missing fixture ${name}.json`);
  return fixture;
}

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not JSON: treat as no args
  }
  return {};
}

interface RestFailure {
  path: string;
  status: number;
  detail: string;
  retryAfterSec?: number;
}

export class FakeWizzrobe {
  readonly calls: { tool: string; token: string; args: Record<string, unknown> }[] = [];

  private readonly answers = new Map<string, unknown>();
  private readonly toolFailures = new Map<string, { code: string; message: string }>();
  private readonly restFailures: RestFailure[] = [];

  featuresOff = true; // bracket, qualifier, race-room tools -> not_found

  // answers from tests/fixtures/wizzrobe/<tool>.json
  readonly rawToolCall: RawToolCall = async (token, name, args) => {
    this.calls.push({ tool: name, token, args });

    const failure = this.toolFailures.get(name);
    if (failure) return { isError: true, text: `${failure.code}: ${failure.message}` };

    if (this.featuresOff && FEATURE_TOOL.test(name)) {
      return { isError: true, text: "not_found: This feature is not enabled for this community." };
    }

    if (this.answers.has(name)) {
      return { isError: false, text: JSON.stringify(this.answers.get(name)) };
    }

    const fixture = readFixture(name);
    if (fixture !== undefined) return { isError: false, text: JSON.stringify(fixture) };

    if (WRITE_TOOLS.has(name)) return { isError: false, text: '{"ok":true}' };

    return { isError: true, text: `not_found: no fixture for ${name}` };
  };

  // REST gaps, from rest_*.json fixtures
  readonly fetch: typeof fetch = async (input, init) => {
    const headers = new Headers(
      typeof input === "object" && !(input instanceof URL) ? input.headers : undefined,
    );
    new Headers(init?.headers).forEach((value, key) => {
      headers.set(key, value);
    });
    const method = (
      init?.method ?? (typeof input === "object" && !(input instanceof URL) ? input.method : "GET")
    ).toUpperCase();
    const path = new URL(requestUrl(input)).pathname;
    const token = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    this.calls.push({ tool: `rest:${method} ${path}`, token, args: parseBody(init?.body) });

    const failure = this.restFailures.find((f) => path.startsWith(f.path));
    if (failure) {
      const extra: Record<string, string> =
        failure.retryAfterSec === undefined ? {} : { "Retry-After": String(failure.retryAfterSec) };
      return json(failure.status, { detail: failure.detail }, extra);
    }

    if (method === "POST" && /^\/api\/matches\/[^/]+\/reschedule-requests\/?$/.test(path)) {
      return json(201, requireFixture("rest_create_reschedule_request"));
    }
    if (method === "POST" && /^\/api\/brackets\/matches\/[^/]+\/games\/?$/.test(path)) {
      return json(201, requireFixture("rest_book_bracket_game"));
    }
    if (method === "GET" && /^\/api\/brackets\/my-open-matches\/?$/.test(path)) {
      const fixture = requireFixture("rest_my_open_bracket_matches") as { result: unknown };
      return json(200, fixture.result);
    }
    return json(404, { detail: "Not Found" });
  };

  // override one tool's result
  answer(tool: string, result: unknown): void {
    this.answers.set(tool, result);
  }

  // isError text "<code>: <message>"
  failTool(tool: string, code: string, message: string): void {
    this.toolFailures.set(tool, { code, message });
  }

  failRest(path: string, status: number, detail: string, retryAfterSec?: number): void {
    this.restFailures.push(
      retryAfterSec === undefined
        ? { path, status, detail }
        : { path, status, detail, retryAfterSec },
    );
  }
}
