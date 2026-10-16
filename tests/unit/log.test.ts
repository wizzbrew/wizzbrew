import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clip, log } from "../../src/log.js";

let out: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  out = vi.spyOn(console, "log").mockImplementation(() => undefined);
  err = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function lastLine(spy: ReturnType<typeof vi.spyOn>): string {
  const call = spy.mock.calls.at(-1);
  if (!call) throw new Error("nothing was logged");
  return String(call[0]);
}

describe("log", () => {
  it("writes one line of valid JSON with ts, level and event", () => {
    log("info", "thing.happened", { a: 1, note: "line one\nline two" });
    const line = lastLine(out);
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("thing.happened");
    expect(parsed.a).toBe(1);
    expect(parsed.note).toBe("line one\nline two");
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
  });

  it("sends warn to stdout and error to stderr", () => {
    log("warn", "w");
    expect(out).toHaveBeenCalledTimes(1);
    expect(err).not.toHaveBeenCalled();
    log("error", "e");
    expect(err).toHaveBeenCalledTimes(1);
    expect(out).toHaveBeenCalledTimes(1);
    expect(JSON.parse(lastLine(err)).level).toBe("error");
  });

  it("clips a 500 character string field to 200 plus an ellipsis", () => {
    log("info", "long", { body: "x".repeat(500) });
    const parsed = JSON.parse(lastLine(out));
    expect(parsed.body).toBe(`${"x".repeat(200)}...`);
  });

  it("clips strings inside nested objects and arrays", () => {
    log("info", "nested", { a: { b: ["y".repeat(300)] } });
    const parsed = JSON.parse(lastLine(out));
    expect(parsed.a.b[0]).toBe(`${"y".repeat(200)}...`);
  });

  it("redacts sensitive keys, nested ones too", () => {
    log("info", "secrets", {
      token: "t-1",
      accessToken: "t-2",
      Authorization: "Bearer t-3",
      refresh_token: "t-4",
      nested: { apiKey: "t-5", deeper: [{ client_secret: "t-6" }], keep: "visible" },
      password: "t-7",
      plain: "visible",
    });
    const line = lastLine(out);
    const parsed = JSON.parse(line);
    expect(parsed.token).toBe("[redacted]");
    expect(parsed.accessToken).toBe("[redacted]");
    expect(parsed.Authorization).toBe("[redacted]");
    expect(parsed.refresh_token).toBe("[redacted]");
    expect(parsed.nested.apiKey).toBe("[redacted]");
    expect(parsed.nested.deeper[0].client_secret).toBe("[redacted]");
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.nested.keep).toBe("visible");
    expect(parsed.plain).toBe("visible");
    expect(line).not.toMatch(/t-[1-7]/);
  });

  it("logs an Error field as name and clipped message", () => {
    log("error", "failed", { error: new TypeError("bad thing") });
    expect(JSON.parse(lastLine(err)).error).toEqual({ name: "TypeError", message: "bad thing" });
  });
});

describe("clip", () => {
  it("returns short text unchanged", () => {
    expect(clip("hello")).toBe("hello");
    expect(clip("x".repeat(200))).toBe("x".repeat(200));
  });

  it("appends an ellipsis only when it cuts", () => {
    expect(clip("x".repeat(201))).toBe(`${"x".repeat(200)}...`);
    expect(clip("abcdefgh", 5)).toBe("abcde...");
    expect(clip("abcde", 5)).toBe("abcde");
  });
});
