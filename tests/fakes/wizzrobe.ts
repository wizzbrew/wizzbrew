import { NotImplemented } from "../../src/errors.js";
import type { RawToolCall } from "../../src/wizzrobe/mcp.js";

export class FakeWizzrobe {
  readonly calls: { tool: string; token: string; args: Record<string, unknown> }[] = [];

  // answers from tests/fixtures/wizzrobe/<tool>.json
  readonly rawToolCall: RawToolCall = async (_token, _name, _args) => {
    throw new NotImplemented("FakeWizzrobe.rawToolCall");
  };

  // REST gaps, from rest_*.json fixtures
  readonly fetch: typeof fetch = async () => {
    throw new NotImplemented("FakeWizzrobe.fetch");
  };

  featuresOff = true; // bracket, qualifier, race-room tools -> not_found

  // override one tool's result
  answer(_tool: string, _result: unknown): void {
    throw new NotImplemented("FakeWizzrobe.answer");
  }

  // isError text "<code>: <message>"
  failTool(_tool: string, _code: string, _message: string): void {
    throw new NotImplemented("FakeWizzrobe.failTool");
  }

  failRest(_path: string, _status: number, _detail: string, _retryAfterSec?: number): void {
    throw new NotImplemented("FakeWizzrobe.failRest");
  }
}
