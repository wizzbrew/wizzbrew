import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { requestUrl } from "./fetch.js";

const FIXTURES = new URL("../fixtures/challonge/", import.meta.url);

// Reads a fixture and drops the top-level `_note`.
function readFixture(name: "tournament" | "participants" | "matches"): unknown {
  const parsed = JSON.parse(
    readFileSync(fileURLToPath(new URL(`${name}.json`, FIXTURES)), "utf8"),
  ) as Record<string, unknown>;
  const { _note: _dropped, ...rest } = parsed;
  return rest;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export class FakeChallonge {
  readonly requests: string[] = []; // URLs fetched
  private failStatus: number | null = null;

  // serves tests/fixtures/challonge/*.json
  readonly fetch: typeof fetch = async (input) => {
    const url = requestUrl(input);
    this.requests.push(url);

    if (this.failStatus !== null) {
      const status = this.failStatus;
      return json(status, { errors: [{ status: String(status), detail: "fake failure" }] });
    }

    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get("page") ?? "1");

    const list = /^\/v2\.1\/tournaments\/[^/]+\/(participants|matches)\.json$/.exec(
      parsed.pathname,
    );
    if (list) {
      if (page > 1) return json(200, { data: [] });
      return json(200, readFixture(list[1] === "participants" ? "participants" : "matches"));
    }
    if (/^\/v2\.1\/tournaments\/[^/]+\.json$/.test(parsed.pathname)) {
      return json(200, readFixture("tournament"));
    }
    return json(404, { errors: [{ status: "404", detail: "Not Found" }] });
  };

  // every later request answers this status
  fail(status: number): void {
    this.failStatus = status;
  }
}
