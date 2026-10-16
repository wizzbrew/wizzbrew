import { describe, expect, it } from "vitest";
import { keys } from "../../src/store/keys.js";

describe("keys", () => {
  it("builds each exact key form", () => {
    expect(keys.link("123456789012345678")).toBe("wb:v1:link:123456789012345678");
    expect(keys.oauthState("abc_DEF-12.x")).toBe("wb:v1:oauth:abc_DEF-12.x");
    expect(keys.botToken()).toBe("wb:v1:token:bot");
    expect(keys.userToken("123")).toBe("wb:v1:token:user:123");
    expect(keys.pending("p-1")).toBe("wb:v1:pending:p-1");
    expect(keys.thread("t.1")).toBe("wb:v1:thread:t.1");
    expect(keys.spend("2026-10-15")).toBe("wb:v1:spend:2026-10-15");
    expect(keys.cache("standings", "9f8e7d")).toBe("wb:v1:cache:standings:9f8e7d");
  });

  it("gives the same key for the same input", () => {
    expect(keys.link("42")).toBe(keys.link("42"));
    expect(keys.cache("scope", "hash")).toBe(keys.cache("scope", "hash"));
  });

  it("gives different keys for different inputs and namespaces", () => {
    expect(keys.link("1")).not.toBe(keys.link("2"));
    expect(keys.link("1")).not.toBe(keys.userToken("1"));
    expect(keys.pending("1")).not.toBe(keys.thread("1"));
    expect(keys.cache("scope", "a")).not.toBe(keys.cache("scope", "b"));
    expect(keys.cache("a", "b")).not.toBe(keys.cache("b", "a"));
  });

  it("accepts a 128 character token part", () => {
    expect(keys.thread("x".repeat(128))).toBe(`wb:v1:thread:${"x".repeat(128)}`);
  });

  const bad: [string, () => string][] = [
    ["discord id with letters", () => keys.link("12a")],
    ["empty discord id", () => keys.userToken("")],
    ["oauth state with a space", () => keys.oauthState("has space")],
    ["oauth state with a slash", () => keys.oauthState("a/b")],
    ["empty cache scope", () => keys.cache("", "hash")],
    ["cache hash with a colon", () => keys.cache("scope", "a:b")],
    ["pending id 129 characters", () => keys.pending("x".repeat(129))],
    ["day with a one digit month", () => keys.spend("2026-1-05")],
    ["day with a trailing newline", () => keys.spend("2026-10-15\n")],
  ];

  it.each(bad)("throws on %s", (_name, build) => {
    expect(build).toThrow(/^invalid /);
  });
});
