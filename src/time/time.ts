import { config } from "../config.js";
import { UserInputError, WizzrobeError } from "../errors.js";

// The one place times are parsed and formatted (L1 to L5). Wizzrobe sends UTC ISO strings, people
// type times on the community clock, Discord shows <t:EPOCH:f>. Every wall-clock conversion goes
// through Intl.DateTimeFormat for the specific instant, so DST is always right (L4).

const DAY_MS = 86_400_000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function nameIndex(names: readonly string[], extra: Record<string, number> = {}) {
  const map = new Map<string, number>();
  names.forEach((name, i) => {
    map.set(name, i);
    map.set(name.slice(0, 3), i);
  });
  for (const [name, i] of Object.entries(extra)) map.set(name, i);
  return map;
}

const WEEKDAY_INDEX = nameIndex(WEEKDAYS);
const MONTH_INDEX = nameIndex(MONTHS, { sept: 8 });

interface Ymd {
  year: number;
  month: number; // 1 to 12
  day: number;
}

interface HourMinute {
  hour: number;
  minute: number;
}

interface Wall extends Ymd, HourMinute {
  second: number;
  weekday: string; // "Thu"
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

const formatYmd = (d: Ymd): string =>
  `${String(d.year).padStart(4, "0")}-${pad2(d.month)}-${pad2(d.day)}`;

const formatHm = (t: HourMinute): string => `${pad2(t.hour)}:${pad2(t.minute)}`;

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function addDays(d: Ymd, n: number): Ymd {
  const moved = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

function parseYmd(text: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const ymd = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isRealDate(ymd.year, ymd.month, ymd.day) ? ymd : null;
}

// ---- Community clock -------------------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallFormatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(zone, f);
  }
  return f;
}

// The community wall clock at an instant. Throws RangeError for an invalid Date.
function wallOf(ms: number): Wall {
  const fields: Record<string, string> = {};
  for (const part of wallFormatter(config().communityTimezone).formatToParts(ms)) {
    if (part.type !== "literal") fields[part.type] = part.value;
  }
  const num = (name: string): number => Number(fields[name]);
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
    weekday: fields.weekday ?? "",
  };
}

// Community offset from UTC at an instant, in ms (negative west of Greenwich).
function offsetMsAt(ms: number): number {
  const w = wallOf(ms);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

// Every instant at which the community clock reads this wall time, earliest first. Empty inside a
// spring-forward gap, two entries for a repeated fall-back time.
function wallInstants(day: Ymd, time: HourMinute): number[] {
  const guess = Date.UTC(day.year, day.month - 1, day.day, time.hour, time.minute);
  const found = new Set<number>();
  for (const probe of [guess - DAY_MS, guess + DAY_MS]) {
    const candidate = guess - offsetMsAt(probe);
    const w = wallOf(candidate);
    if (
      w.year === day.year &&
      w.month === day.month &&
      w.day === day.day &&
      w.hour === time.hour &&
      w.minute === time.minute
    ) {
      found.add(candidate);
    }
  }
  return [...found].sort((a, b) => a - b);
}

function instantFor(day: Ymd, time: HourMinute): Date {
  const first = wallInstants(day, time)[0];
  if (first === undefined) {
    throw new UserInputError(
      `${formatHm(time)} on ${formatYmd(day)} doesn't exist because the clocks change then. Pick another time.`,
    );
  }
  return new Date(first);
}

// First instant of a community day. If midnight itself is skipped, the first wall minute that
// exists.
function startOfDay(day: Ymd): Date {
  for (let minute = 0; minute < 24 * 60; minute++) {
    const first = wallInstants(day, { hour: Math.floor(minute / 60), minute: minute % 60 })[0];
    if (first !== undefined) return new Date(first);
  }
  throw new UserInputError(`${formatYmd(day)} has no times in the community time zone.`);
}

// ---- Formatting ------------------------------------------------------------------------------

export function nowBlock(now: Date): string {
  const w = wallOf(now.getTime());
  return `Current time: ${w.weekday} ${formatYmd(w)} ${formatHm(w)} ${config().communityTimezone}`;
}

export function discordTimestamp(d: Date, style?: "f" | "F" | "t" | "R"): string {
  const ms = d.getTime();
  if (Number.isNaN(ms)) throw new RangeError("discordTimestamp needs a valid date");
  return `<t:${Math.floor(ms / 1000)}:${style ?? "f"}>`;
}

export function communityDate(d: Date): string {
  return formatYmd(wallOf(d.getTime()));
}

// ---- Wizzrobe times --------------------------------------------------------------------------

const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})$/;

export function parseWizzrobeTime(iso: string): Date {
  const bad = () => new WizzrobeError(502, "Wizzrobe sent an unreadable time");
  const m = ISO_INSTANT.exec(iso);
  if (!m) throw bad();
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "00"].map(
    Number,
  ) as [number, number, number, number, number, number];
  const millis = (m[7] ?? "").slice(0, 3).padEnd(3, "0");
  const zone = m[8] ?? "";
  let offset = zone;
  if (zone !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    if (Number(digits.slice(0, 2)) > 23 || Number(digits.slice(2)) > 59) throw bad();
    offset = `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  if (!isRealDate(year, month, day) || hour > 23 || minute > 59 || second > 59) throw bad();
  const parsed = new Date(
    `${m[1]}-${m[2]}-${m[3]}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${millis}${offset}`,
  );
  if (Number.isNaN(parsed.getTime())) throw bad();
  return parsed;
}

// ---- What people type ------------------------------------------------------------------------

type DateSpec =
  | { kind: "relative"; days: number }
  | { kind: "weekday"; weekday: number } // 0 = Sunday
  | { kind: "iso"; text: string }
  | { kind: "monthday"; month: number; day: number; text: string };

interface Scan {
  date: DateSpec | null;
  time: HourMinute | null;
}

function shorten(text: string): string {
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

const ORDINAL_DAY = /^(\d{1,2})(?:st|nd|rd|th)?$/;

function matchDate(tok: string, next: string | undefined): { spec: DateSpec; used: number } | null {
  if (tok === "today") return { spec: { kind: "relative", days: 0 }, used: 1 };
  if (tok === "tomorrow") return { spec: { kind: "relative", days: 1 }, used: 1 };

  const weekday = WEEKDAY_INDEX.get(tok);
  if (weekday !== undefined) return { spec: { kind: "weekday", weekday }, used: 1 };

  if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) return { spec: { kind: "iso", text: tok }, used: 1 };

  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(tok);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    return { spec: { kind: "monthday", month, day, text: tok }, used: 1 };
  }

  const monthFirst = MONTH_INDEX.get(tok);
  if (monthFirst !== undefined && next !== undefined) {
    const d = ORDINAL_DAY.exec(next);
    if (d) {
      const text = `${tok} ${next}`;
      return {
        spec: { kind: "monthday", month: monthFirst + 1, day: Number(d[1]), text },
        used: 2,
      };
    }
  }

  const dayFirst = ORDINAL_DAY.exec(tok);
  const monthSecond = next === undefined ? undefined : MONTH_INDEX.get(next);
  if (dayFirst && monthSecond !== undefined) {
    const text = `${tok} ${next}`;
    return {
      spec: { kind: "monthday", month: monthSecond + 1, day: Number(dayFirst[1]), text },
      used: 2,
    };
  }
  return null;
}

function to24Hour(hour12: number, meridiem: string): number | null {
  if (hour12 < 1 || hour12 > 12) return null;
  return (hour12 % 12) + (meridiem === "pm" ? 12 : 0);
}

function validTime(hour: number | null, minute: number): HourMinute | null {
  if (hour === null || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function matchTime(
  tok: string,
  next: string | undefined,
): { time: HourMinute; used: number } | null {
  const result = (time: HourMinute | null, used: number) => (time ? { time, used } : null);

  const joined = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(tok);
  if (joined) {
    return result(
      validTime(to24Hour(Number(joined[1]), joined[3] ?? ""), Number(joined[2] ?? 0)),
      1,
    );
  }

  const split = /^(\d{1,2})(?::(\d{2}))?$/.exec(tok);
  if (split && (next === "am" || next === "pm")) {
    return result(validTime(to24Hour(Number(split[1]), next), Number(split[2] ?? 0)), 2);
  }

  const clock = /^(\d{1,2}):(\d{2})$/.exec(tok);
  if (clock) return result(validTime(Number(clock[1]), Number(clock[2])), 1);

  // Four digits are always a 24-hour time, never a year (L3).
  const compact = /^(\d{2})(\d{2})$/.exec(tok);
  if (compact) return result(validTime(Number(compact[1]), Number(compact[2])), 1);

  if (/^\d{1,2}$/.test(tok)) return result(validTime(Number(tok), 0), 1);
  return null;
}

function scanText(text: string): Scan {
  const tokens = text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t !== "" && t !== "at");
  let date: DateSpec | null = null;
  let time: HourMinute | null = null;
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i] ?? "";
    const next = tokens[i + 1];
    const asDate = matchDate(tok, next);
    if (asDate) {
      if (date) throw new UserInputError("I found more than one date there. Give me just one.");
      date = asDate.spec;
      i += asDate.used;
      continue;
    }
    const asTime = matchTime(tok, next);
    if (asTime) {
      if (time) throw new UserInputError("I found more than one time there. Give me just one.");
      time = asTime.time;
      i += asTime.used;
      continue;
    }
    throw new UserInputError(`I couldn't read "${shorten(tok)}" as a date or time.`);
  }
  return { date, time };
}

function resolveDate(spec: DateSpec, now: Date): Ymd {
  const today = parseYmd(communityDate(now));
  if (!today) throw new RangeError("communityDate produced an unreadable date");

  if (spec.kind === "relative") return addDays(today, spec.days);

  if (spec.kind === "weekday") {
    const current = WEEKDAY_INDEX.get(wallOf(now.getTime()).weekday.toLowerCase());
    if (current === undefined) throw new RangeError("unreadable weekday for the community clock");
    return addDays(today, (spec.weekday - current + 7) % 7);
  }

  if (spec.kind === "iso") {
    const ymd = parseYmd(spec.text);
    if (!ymd) throw new UserInputError(`"${spec.text}" isn't a real date.`);
    return ymd;
  }

  // Month and day: this year, or next year if that date has already passed.
  const todayText = formatYmd(today);
  for (const year of [today.year, today.year + 1]) {
    if (!isRealDate(year, spec.month, spec.day)) continue;
    const candidate = { year, month: spec.month, day: spec.day };
    if (formatYmd(candidate) >= todayText) return candidate;
  }
  throw new UserInputError(`"${shorten(spec.text)}" isn't a real date.`);
}

export function parseUserDate(text: string, now: Date): string {
  const scan = scanText(text);
  if (!scan.date) {
    throw new UserInputError(
      "I need a date, like today, tomorrow, a weekday, Oct 17 or 2026-10-17.",
    );
  }
  if (scan.time) throw new UserInputError("I only need a date there, without a time.");
  return formatYmd(resolveDate(scan.date, now));
}

export function parseUserDateTime(
  text: string,
  now: Date,
): { date: string; time: string; instant: Date } {
  const scan = scanText(text);
  if (!scan.time) throw new UserInputError("I need a time too, like 8pm or 20:00.");
  const spec: DateSpec = scan.date ?? { kind: "relative", days: 0 };
  let day = resolveDate(spec, now);
  let instant = instantFor(day, scan.time);
  // A bare weekday never means the past: move a week ahead.
  if (spec.kind === "weekday" && instant.getTime() < now.getTime()) {
    day = addDays(day, 7);
    instant = instantFor(day, scan.time);
  }
  return { date: formatYmd(day), time: formatHm(scan.time), instant };
}

export function dayWindowUtc(date: string): { start: Date; end: Date } {
  const day = parseYmd(date);
  if (!day) throw new UserInputError(`"${shorten(date)}" isn't a date I can read. Use YYYY-MM-DD.`);
  return { start: startOfDay(day), end: startOfDay(addDays(day, 1)) };
}
