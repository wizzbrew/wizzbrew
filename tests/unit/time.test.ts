import { describe, expect, it } from "vitest";
import { UserInputError, WizzrobeError } from "../../src/errors.js";
import {
  communityDate,
  communityHm,
  dayWindowUtc,
  discordTimestamp,
  isYmd,
  nowBlock,
  parseUserDate,
  parseUserDateTime,
  parseWizzrobeTime,
} from "../../src/time/time.js";

// Thu 2026-10-15 12:00 in New York (EDT, UTC-4).
const NOW = new Date("2026-10-15T16:00:00Z");

const iso = (d: Date): string => d.toISOString();

function at(text: string, now: Date = NOW): { date: string; time: string; utc: string } {
  const r = parseUserDateTime(text, now);
  return { date: r.date, time: r.time, utc: iso(r.instant) };
}

describe("nowBlock", () => {
  it("renders the community clock, 24-hour, with the zone", () => {
    expect(nowBlock(new Date("2026-10-16T00:14:00Z"))).toBe(
      "Current time: Thu 2026-10-15 20:14 America/New_York",
    );
  });

  it("shows 00:xx at midnight, not 24:xx", () => {
    expect(nowBlock(new Date("2026-10-16T04:05:00Z"))).toBe(
      "Current time: Fri 2026-10-16 00:05 America/New_York",
    );
  });
});

describe("discordTimestamp", () => {
  const d = new Date("2026-10-16T17:00:00Z");
  const epoch = Math.floor(d.getTime() / 1000);

  it("defaults to style f", () => {
    expect(discordTimestamp(d)).toBe(`<t:${epoch}:f>`);
    expect(epoch).toBe(1792170000);
  });

  it("takes an explicit style", () => {
    expect(discordTimestamp(d, "R")).toBe(`<t:${epoch}:R>`);
  });

  it("floors milliseconds", () => {
    expect(discordTimestamp(new Date("2026-10-16T17:00:00.999Z"), "t")).toBe(`<t:${epoch}:t>`);
  });

  it("refuses an invalid date", () => {
    expect(() => discordTimestamp(new Date("nope"))).toThrow(RangeError);
  });
});

describe("parseWizzrobeTime", () => {
  it("reads Z, numeric offsets and fractional seconds", () => {
    expect(iso(parseWizzrobeTime("2026-10-16T17:00:00Z"))).toBe("2026-10-16T17:00:00.000Z");
    expect(iso(parseWizzrobeTime("2026-10-16T17:00:00+00:00"))).toBe("2026-10-16T17:00:00.000Z");
    expect(iso(parseWizzrobeTime("2026-10-16T17:00:00.250Z"))).toBe("2026-10-16T17:00:00.250Z");
    expect(iso(parseWizzrobeTime("2026-10-16T17:00:00.123456Z"))).toBe("2026-10-16T17:00:00.123Z");
    expect(iso(parseWizzrobeTime("2026-10-16T13:00:00-04:00"))).toBe("2026-10-16T17:00:00.000Z");
    expect(iso(parseWizzrobeTime("2026-10-16T19:00:00+0200"))).toBe("2026-10-16T17:00:00.000Z");
  });

  it.each([
    "2026-10-16 17:00",
    "2026-10-16T17:00:00",
    "garbage",
    "",
    "2026-02-30T10:00:00Z",
    "2026-10-16T25:00:00Z",
    "2026-10-16T17:61:00Z",
    "2026-10-16T17:00:00+25:00",
  ])("rejects %j with a 502", (text) => {
    let caught: unknown;
    try {
      parseWizzrobeTime(text);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(WizzrobeError);
    expect((caught as WizzrobeError).status).toBe(502);
    expect((caught as WizzrobeError).detail).toBe("Wizzrobe sent an unreadable time");
  });
});

describe("communityDate", () => {
  it("uses the community calendar date across UTC midnight", () => {
    expect(communityDate(new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-15");
    expect(communityDate(new Date("2026-10-16T04:00:00Z"))).toBe("2026-10-16");
  });
});

describe("communityHm", () => {
  it("is HH:MM on the community clock, on both sides of a DST change (L4)", () => {
    expect(communityHm(new Date("2026-10-17T18:32:00Z"))).toBe("14:32"); // EDT, UTC-4
    expect(communityHm(new Date("2026-11-02T18:32:00Z"))).toBe("13:32"); // EST, UTC-5
    expect(communityHm(new Date("2026-10-16T04:05:00Z"))).toBe("00:05");
  });
});

describe("isYmd", () => {
  it("accepts real dates written YYYY-MM-DD only", () => {
    expect(isYmd("2026-10-17")).toBe(true);
    expect(isYmd("2028-02-29")).toBe(true);
    expect(isYmd("2026-02-29")).toBe(false);
    expect(isYmd("2026-13-01")).toBe(false);
    expect(isYmd("2026-1-01")).toBe(false);
    expect(isYmd("tomorrow")).toBe(false);
    expect(isYmd("2026-10-17 ")).toBe(false);
  });
});

describe("parseUserDateTime", () => {
  it("reads four digits as a 24-hour time, never a year (L3)", () => {
    expect(at("2300")).toEqual({
      date: "2026-10-15",
      time: "23:00",
      utc: "2026-10-16T03:00:00.000Z",
    });
    expect(at("0800").time).toBe("08:00");
  });

  it("reads 12-hour and 24-hour forms", () => {
    expect(at("8pm")).toEqual({
      date: "2026-10-15",
      time: "20:00",
      utc: "2026-10-16T00:00:00.000Z",
    });
    expect(at("8 pm").time).toBe("20:00");
    expect(at("8:30pm").time).toBe("20:30");
    expect(at("8:30 PM").time).toBe("20:30");
    expect(at("12am").time).toBe("00:00");
    expect(at("12pm").time).toBe("12:00");
    expect(at("12:15 am").time).toBe("00:15");
    expect(at("20:00").time).toBe("20:00");
    expect(at("9:05").time).toBe("09:05");
  });

  it("reads a bare hour", () => {
    expect(at("8")).toEqual({ date: "2026-10-15", time: "08:00", utc: "2026-10-15T12:00:00.000Z" });
    expect(at("tomorrow 9")).toEqual({
      date: "2026-10-16",
      time: "09:00",
      utc: "2026-10-16T13:00:00.000Z",
    });
  });

  it("reads weekdays, month names and m/d with a time in either order", () => {
    expect(at("sat 8:30 pm")).toEqual({
      date: "2026-10-17",
      time: "20:30",
      utc: "2026-10-18T00:30:00.000Z",
    });
    expect(at("Oct 17 2pm")).toEqual({
      date: "2026-10-17",
      time: "14:00",
      utc: "2026-10-17T18:00:00.000Z",
    });
    expect(at("10/17 1400")).toEqual({
      date: "2026-10-17",
      time: "14:00",
      utc: "2026-10-17T18:00:00.000Z",
    });
    expect(at("2pm October 17").date).toBe("2026-10-17");
    expect(at("17 Oct 2pm").date).toBe("2026-10-17");
    expect(at("tomorrow at 9am")).toEqual(at("9am tomorrow"));
    expect(at("  TOMORROW   AT   9AM  ").time).toBe("09:00");
  });

  it("never lands a weekday in the past", () => {
    expect(at("thu 9am")).toEqual({
      date: "2026-10-22",
      time: "09:00",
      utc: "2026-10-22T13:00:00.000Z",
    });
    expect(at("thursday 1pm").date).toBe("2026-10-15");
  });

  it("rejects a missing time, extra words and bad values", () => {
    for (const text of [
      "2026-11-01",
      "tomorrow",
      "",
      "noon tomorrow banana",
      "8pm 9pm",
      "tomorrow saturday 9am",
      "2460",
      "25",
      "13pm",
      "0am",
      "830",
      "2026-02-30 9am",
      "Feb 30 9am",
    ]) {
      expect(() => parseUserDateTime(text, NOW), text).toThrow(UserInputError);
    }
  });

  it("keeps messages plain: no em or en dashes", () => {
    for (const text of ["banana", "2026-02-30 9am", "tomorrow", "2026-03-08 2:30am"]) {
      try {
        parseUserDateTime(text, NOW);
      } catch (err) {
        for (const code of [0x2013, 0x2014]) {
          expect((err as Error).message).not.toContain(String.fromCharCode(code));
        }
      }
    }
  });
});

describe("parseUserDate", () => {
  it("reads relative words and weekdays", () => {
    expect(parseUserDate("today", NOW)).toBe("2026-10-15");
    expect(parseUserDate("tomorrow", NOW)).toBe("2026-10-16");
    expect(parseUserDate("saturday", NOW)).toBe("2026-10-17");
    expect(parseUserDate("Sat", NOW)).toBe("2026-10-17");
    expect(parseUserDate("thursday", NOW)).toBe("2026-10-15");
    expect(parseUserDate("wed", NOW)).toBe("2026-10-21");
  });

  it("counts today as occurrence 0 for a weekday", () => {
    const saturday = new Date("2026-10-17T16:00:00Z");
    expect(parseUserDate("saturday", saturday)).toBe("2026-10-17");
    expect(parseUserDate("sunday", saturday)).toBe("2026-10-18");
  });

  it("reads explicit dates", () => {
    expect(parseUserDate("2026-10-20", NOW)).toBe("2026-10-20");
    expect(parseUserDate("Oct 20", NOW)).toBe("2026-10-20");
    expect(parseUserDate("October 20", NOW)).toBe("2026-10-20");
    expect(parseUserDate("20 Oct", NOW)).toBe("2026-10-20");
    expect(parseUserDate("10/20", NOW)).toBe("2026-10-20");
  });

  it("rolls a passed month and day into next year, but keeps today", () => {
    expect(parseUserDate("Jan 5", NOW)).toBe("2027-01-05");
    expect(parseUserDate("Oct 15", NOW)).toBe("2026-10-15");
    expect(parseUserDate("Oct 14", NOW)).toBe("2027-10-14");
  });

  it("uses the community calendar for today", () => {
    const lateNewYearsEve = new Date("2027-01-01T04:30:00Z"); // Dec 31 23:30 in New York
    expect(parseUserDate("today", lateNewYearsEve)).toBe("2026-12-31");
    expect(parseUserDate("tomorrow", lateNewYearsEve)).toBe("2027-01-01");
  });

  it("rejects anything else", () => {
    for (const text of [
      "someday",
      "",
      "Feb 30",
      "2026-02-30",
      "tomorrow 9",
      "today tomorrow",
      "13/40",
    ]) {
      expect(() => parseUserDate(text, NOW), text).toThrow(UserInputError);
    }
  });

  it("names what it could not read", () => {
    expect(() => parseUserDate("someday", NOW)).toThrow(/someday/);
  });
});

describe("dayWindowUtc and DST (L4)", () => {
  const hours = (w: { start: Date; end: Date }): number =>
    (w.end.getTime() - w.start.getTime()) / 3_600_000;

  it("makes an ordinary day 24 hours", () => {
    const w = dayWindowUtc("2026-10-15");
    expect(iso(w.start)).toBe("2026-10-15T04:00:00.000Z");
    expect(hours(w)).toBe(24);
  });

  it("makes the fall-back day 25 hours", () => {
    const w = dayWindowUtc("2026-11-01");
    expect(iso(w.start)).toBe("2026-11-01T04:00:00.000Z");
    expect(iso(w.end)).toBe("2026-11-02T05:00:00.000Z");
    expect(hours(w)).toBe(25);
  });

  it("makes the spring-forward day 23 hours", () => {
    const w = dayWindowUtc("2026-03-08");
    expect(iso(w.start)).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(w.end)).toBe("2026-03-09T04:00:00.000Z");
    expect(hours(w)).toBe(23);
  });

  it("rejects a malformed date", () => {
    for (const text of ["2026-13-01", "2026-02-30", "tomorrow", "10/17", ""]) {
      expect(() => dayWindowUtc(text), text).toThrow(UserInputError);
    }
  });

  it("converts wall times with the offset in force on that day", () => {
    expect(at("2026-10-31 9am").utc).toBe("2026-10-31T13:00:00.000Z");
    expect(at("2026-11-02 9am").utc).toBe("2026-11-02T14:00:00.000Z");
  });

  it("rejects a wall time inside the spring-forward gap", () => {
    expect(() => parseUserDateTime("2026-03-08 2:30am", NOW)).toThrow(UserInputError);
    expect(() => parseUserDateTime("2026-03-08 2:30am", NOW)).toThrow(/clocks change/);
    expect(at("2026-03-08 1:59am").utc).toBe("2026-03-08T06:59:00.000Z");
    expect(at("2026-03-08 3am").utc).toBe("2026-03-08T07:00:00.000Z");
  });

  it("takes the first instant of a repeated fall-back wall time", () => {
    expect(at("2026-11-01 1:30am").utc).toBe("2026-11-01T05:30:00.000Z");
  });
});
