import { z } from "zod";
import { log } from "../log.js";
import { keys } from "./keys.js";
import { kv } from "./kv.js";

// The DM log: one list of JSON lines per community-timezone day, and one hash of per-user counts.
// The count backs the daily DM cap; the list backs the owner's /dmlog. Both expire after 14 days.
// A DM stores the question and the answer text, so this is personal data: it is read only by the
// owner command and by the cap check, and it is never written to the logs (L24).

export const DM_RETENTION_SEC = 14 * 24 * 60 * 60;
export const DM_QUESTION_MAX = 300;
export const DM_RESPONSE_MAX = 500;
export const DM_NAME_MAX = 80;
export const DM_ENTRIES_SHOWN = 20;
// How far back from the end of the day's list a read goes: enough to find a name for every
// regular, bounded so a flood of attempts cannot make the read huge.
const ENTRIES_READ = 500;

export interface DmRecordInput {
  day: string; // community-timezone date, YYYY-MM-DD
  userId: string; // Discord user id
  userName: string;
  question: string;
  route: string; // the router's route, or "rate_limited" for a refused attempt
  response: string; // the final answer text; empty for a refused attempt
  at?: Date; // when it happened; defaults to now
}

export interface DmEntry {
  ts: string; // ISO instant
  userId: string;
  userName: string;
  question: string;
  route: string;
  response: string;
}

export interface DmUserCount {
  userId: string;
  userName: string | null; // the latest name seen in the entries read; null when none was
  count: number;
}

export interface DmLogView {
  day: string;
  total: number; // sum of the per-user counts, refused attempts included
  users: DmUserCount[]; // count descending, then id
  entries: DmEntry[]; // the last DM_ENTRIES_SHOWN, oldest first
}

const DISCORD_ID = /^\d+$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const EntrySchema = z.object({
  ts: z.string().regex(ISO_INSTANT),
  userId: z.string().regex(DISCORD_ID),
  userName: z.string(),
  question: z.string(),
  route: z.string(),
  response: z.string(),
});

const CountSchema = z.coerce.number().int().nonnegative();

function userIdOf(userId: string): string {
  if (!DISCORD_ID.test(userId)) throw new Error("invalid discord id");
  return userId;
}

// At most max characters, an ellipsis counting toward the limit, never a split surrogate pair.
function clipTo(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max - 3);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return `${cut}...`;
}

// The DM questions one user has sent on a day, refused attempts included. 0 when none.
export async function dmCount(day: string, userId: string): Promise<number> {
  const raw = await kv().hget(keys.dmCount(day), userIdOf(userId));
  return raw === null ? 0 : CountSchema.parse(raw);
}

// Two writes and two expiries: the list line and the per-user count.
export async function recordDm(input: DmRecordInput): Promise<void> {
  const entry: DmEntry = {
    ts: (input.at ?? new Date()).toISOString(),
    userId: userIdOf(input.userId),
    userName: clipTo(input.userName, DM_NAME_MAX),
    question: clipTo(input.question, DM_QUESTION_MAX),
    route: input.route,
    response: clipTo(input.response, DM_RESPONSE_MAX),
  };
  await kv().rpush(keys.dmLog(input.day), JSON.stringify(entry), DM_RETENTION_SEC);
  await kv().hincrby(keys.dmCount(input.day), entry.userId, 1, DM_RETENTION_SEC);
}

// Upstash hands back a stored JSON line already parsed; another client hands back the string.
function entryFrom(raw: unknown): DmEntry | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = EntrySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Per-user counts for a day, plus the last entries. Two Redis commands.
export async function readDmLog(day: string): Promise<DmLogView> {
  const [counts, lines] = await Promise.all([
    kv().hgetall(keys.dmCount(day)),
    kv().lrange(keys.dmLog(day), -ENTRIES_READ, -1),
  ]);

  const entries: DmEntry[] = [];
  let skipped = 0;
  for (const line of lines) {
    const entry = entryFrom(line);
    if (entry) entries.push(entry);
    else skipped += 1;
  }
  if (skipped > 0) log("warn", "dmlog.skipped_lines", { day, skipped });

  // Entries run oldest first, so the last write for an id is its latest name.
  const names = new Map<string, string>();
  for (const entry of entries) names.set(entry.userId, entry.userName);

  const users: DmUserCount[] = Object.entries(counts).map(([userId, value]) => ({
    userId,
    userName: names.get(userId) ?? null,
    count: CountSchema.parse(value),
  }));
  users.sort((a, b) => b.count - a.count || (a.userId < b.userId ? -1 : 1));

  return {
    day,
    total: users.reduce((sum, u) => sum + u.count, 0),
    users,
    entries: entries.slice(-DM_ENTRIES_SHOWN),
  };
}
