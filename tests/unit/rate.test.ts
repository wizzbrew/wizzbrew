import { beforeEach, describe, expect, it } from "vitest";
import { allowRequest } from "../../src/ops/rate.js";
import { setKvForTests } from "../../src/store/kv.js";
import { FakeKv } from "../fakes/kv.js";

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);
let now = T0;

beforeEach(() => {
  now = T0;
  setKvForTests(new FakeKv(() => now));
});

describe("allowRequest", () => {
  it("allows 8 a minute and blocks the 9th", async () => {
    for (let i = 0; i < 8; i++) expect(await allowRequest("1", new Date(now))).toBe(true);
    expect(await allowRequest("1", new Date(now))).toBe(false);
  });

  it("is per user", async () => {
    for (let i = 0; i < 9; i++) await allowRequest("1", new Date(now));
    expect(await allowRequest("2", new Date(now))).toBe(true);
  });

  it("resets the minute window", async () => {
    for (let i = 0; i < 9; i++) await allowRequest("1", new Date(now));
    now += 60_000;
    expect(await allowRequest("1", new Date(now))).toBe(true);
  });

  it("blocks past 60 an hour", async () => {
    let allowed = 0;
    for (let i = 0; i < 70; i++) {
      if (await allowRequest("1", new Date(now))) allowed++;
      if (i % 8 === 7) now += 60_000;
    }
    expect(allowed).toBe(60);
  });
});
