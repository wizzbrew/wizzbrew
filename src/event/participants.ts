import { z } from "zod";
import { configFor } from "../config.js";
import { log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";

// The SGL26 attendee list: the public participants list of the Matcherino bounty in
// MATCHERINO_BOUNTY_ID. The endpoint also returns ids and avatar URLs that embed Discord ids;
// they are dropped at the parse boundary, so only the display name and the join time are ever
// held, cached or logged. It never throws and a failure never reaches the answer.

export const PARTICIPANTS_FRESH_SEC = 1200; // a fetched list is served for 20 minutes
export const PARTICIPANTS_STALE_SEC = 24 * 60 * 60; // and kept for a day as the fallback
export const PARTICIPANTS_TIMEOUT_MS = 5000; // per request
export const PARTICIPANTS_PAGE_SIZE = 500;
export const PARTICIPANTS_MAX_EXTRA_PAGES = 3; // pages after page 0
export const PARTICIPANTS_MAX_MATCHES = 5;

const PARTICIPANTS_URL = "https://api.matcherino.com/__api/bounties/participants";

export interface Participant {
  displayName: string;
  addedAt: string;
}

export interface ParticipantList {
  names: Participant[];
  count: number; // the total Matcherino reports, which can exceed names when pages were capped
  fetchedAt: number; // epoch ms
}

// zod objects drop unknown keys, so authId, userId and avatar never leave this parse.
const Entry = z.object({ displayName: z.string(), addedAt: z.string() });

const Page = z.object({
  body: z.object({
    itemCount: z.number().int().nonnegative(),
    contents: z.array(z.unknown()),
  }),
});

const ListSchema = z.object({
  names: z.array(Entry),
  count: z.number().int().nonnegative(),
  fetchedAt: z.number().int().nonnegative(),
});

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown";
}

async function readList(key: string): Promise<ParticipantList | null> {
  try {
    const raw = await kv().get<unknown>(key);
    if (raw === null) return null;
    const parsed = ListSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    log("warn", "participants.cache_invalid", { key });
    return null;
  } catch (err) {
    log("warn", "participants.cache_failed", { op: "read", error: errorName(err) });
    return null;
  }
}

async function writeList(id: string, list: ParticipantList): Promise<void> {
  try {
    await kv().set(keys.participants(id), list, PARTICIPANTS_FRESH_SEC);
    await kv().set(keys.participantsStale(id), list, PARTICIPANTS_STALE_SEC);
  } catch (err) {
    log("warn", "participants.cache_failed", { op: "write", error: errorName(err) });
  }
}

interface PageResult {
  itemCount: number;
  names: Participant[];
}

// One page, trimmed to display name and join time, or null after logging why not.
async function fetchPage(id: string, page: number): Promise<PageResult | null> {
  const url = new URL(PARTICIPANTS_URL);
  url.searchParams.set("bountyId", id);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(PARTICIPANTS_PAGE_SIZE));
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(PARTICIPANTS_TIMEOUT_MS),
    });
  } catch (err) {
    log("warn", "participants.fetch_failed", { error: errorName(err) });
    return null;
  }
  if (!res.ok) {
    log("warn", "participants.fetch_failed", { status: res.status });
    return null;
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    log("warn", "participants.fetch_failed", { error: errorName(err) });
    return null;
  }
  const parsed = Page.safeParse(body);
  if (!parsed.success) {
    log("warn", "participants.fetch_failed", { error: "BadShape" });
    return null;
  }
  const names: Participant[] = [];
  let skipped = 0;
  for (const item of parsed.data.body.contents) {
    const entry = Entry.safeParse(item);
    const displayName = entry.success ? entry.data.displayName.trim() : "";
    if (entry.success && displayName !== "") {
      names.push({ displayName, addedAt: entry.data.addedAt });
    } else {
      skipped += 1;
    }
  }
  if (skipped > 0) log("warn", "participants.entries_skipped", { count: skipped });
  return { itemCount: parsed.data.body.itemCount, names };
}

// The whole list (page 0, then up to three more pages when Matcherino reports more), or null
// when any page fails: a partial list would turn a missing name into a wrong "no record".
async function fetchList(id: string, now: number): Promise<ParticipantList | null> {
  const first = await fetchPage(id, 0);
  if (first === null) return null;
  const pages = Math.ceil(first.itemCount / PARTICIPANTS_PAGE_SIZE);
  const extra = Math.max(0, Math.min(pages - 1, PARTICIPANTS_MAX_EXTRA_PAGES));
  const rest = await Promise.all(Array.from({ length: extra }, (_, i) => fetchPage(id, i + 1)));
  const names = [...first.names];
  for (const page of rest) {
    if (page === null) return null;
    names.push(...page.names);
  }
  return { names, count: first.itemCount, fetchedAt: now };
}

// The attendee list from Matcherino, or null when the feature is off (no bounty id; no network
// call) or nothing usable is known.
export async function eventParticipants(): Promise<ParticipantList | null> {
  let id: string | null;
  try {
    id = configFor("matcherinoBountyId").matcherinoBountyId;
  } catch (err) {
    log("warn", "participants.config_invalid", { error: errorName(err) });
    return null;
  }
  if (id === null) return null;

  try {
    const fresh = await readList(keys.participants(id));
    if (fresh) return fresh;

    const list = await fetchList(id, Date.now());
    if (list !== null) {
      await writeList(id, list);
      return list;
    }

    return await readList(keys.participantsStale(id));
  } catch (err) {
    log("warn", "participants.fetch_failed", { error: errorName(err) });
    return null;
  }
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== "");
}

// True when needle appears in hay as a run of whole words.
function hasWholeWords(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    if (needle.every((word, j) => hay[i + j] === word)) return true;
  }
  return false;
}

// Display names equal to the name ignoring case first, then those holding it as a whole word,
// at most five. Never a partial-word match, so a short name does not sweep up strangers.
export function findParticipants(list: Participant[], name: string): Participant[] {
  const wanted = name.trim().toLowerCase();
  const wantedWords = tokens(name);
  if (wanted === "" || wantedWords.length === 0) return [];
  const exact = list.filter((p) => p.displayName.trim().toLowerCase() === wanted);
  const word = list.filter(
    (p) =>
      p.displayName.trim().toLowerCase() !== wanted &&
      hasWholeWords(tokens(p.displayName), wantedWords),
  );
  return [...exact, ...word].slice(0, PARTICIPANTS_MAX_MATCHES);
}
