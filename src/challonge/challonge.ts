import { z } from "zod";
import { config } from "../config.js";
import { log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import { communityDate, parseUserDateTime, parseWizzrobeTime } from "../time/time.js";
import { callTool } from "../wizzrobe/mcp.js";
import { botAccessToken } from "../wizzrobe/tokens.js";

export interface BracketSummary {
  tournament: string;
  bracketUrl: string;
  rulesUrl: string | null;
  state: string | null; // derived from the matches: complete, underway or pending
  alive: string[];
  eliminated: string[]; // participant display names
  recent: { round: string; players: [string, string]; winner: string | null }[];
  upcoming: { round: string; players: [string | null, string | null] }[]; // null = slot not decided yet
  source: "challonge" | "link_only"; // link_only when no key, no bracket or the fetch failed
  fetchedAt: string | null; // ISO time the snapshot was taken
  degraded: boolean; // true when a refresh was attempted and failed; the stale or link-only answer is served
}

interface Snapshot {
  summary: BracketSummary;
  etags?: { participants?: string; matches?: string };
}

const API = "https://api.challonge.com/v2.1";
const PER_PAGE = 100;
const MAX_PAGES = 5;
const MAX_AGE_MS = 60 * 60 * 1000;
const QUIET_UNTIL = "08:00";
const MONTHLY_LIMIT = 450;
const COUNT_TTL_SEC = 3456000;
const MAX_RECENT = 8;

class ChallongeFailure extends Error {
  constructor(readonly status: number | undefined) {
    super("challonge request failed");
  }
}

const tournamentSchema = z.object({
  name: z.string(),
  bracket_url: z.string().nullable().optional(),
  rules_url: z.string().nullable().optional(),
});

const snapshotSchema = z.object({
  summary: z.object({
    tournament: z.string(),
    bracketUrl: z.string(),
    rulesUrl: z.string().nullable(),
    state: z.string().nullable(),
    alive: z.array(z.string()),
    eliminated: z.array(z.string()),
    recent: z.array(
      z.object({
        round: z.string(),
        players: z.tuple([z.string(), z.string()]),
        winner: z.string().nullable(),
      }),
    ),
    upcoming: z.array(
      z.object({
        round: z.string(),
        players: z.tuple([z.string().nullable(), z.string().nullable()]),
      }),
    ),
    source: z.enum(["challonge", "link_only"]),
    fetchedAt: z.string().nullable(),
    degraded: z.boolean().default(false),
  }),
  etags: z
    .object({ participants: z.string().optional(), matches: z.string().optional() })
    .optional(),
});

const participantsSchema = z.object({
  data: z.array(
    z.object({
      id: z.coerce.string(),
      attributes: z.object({
        name: z.string(),
        seed: z.number().nullish(),
        final_rank: z.number().nullish(),
        states: z.object({ active: z.boolean().optional() }).nullish(),
      }),
    }),
  ),
});

const playerRef = z.object({ data: z.object({ id: z.coerce.string() }).nullable() }).nullish();
const relationshipsSchema = z.object({ player1: playerRef, player2: playerRef });

const matchesSchema = z.object({
  data: z.array(
    z.object({
      id: z.coerce.string(),
      attributes: z.object({
        state: z.string(),
        round: z.number(),
        winner_id: z.coerce.string().nullish(),
        relationships: relationshipsSchema.optional(),
      }),
      relationships: relationshipsSchema.optional(),
    }),
  ),
});

type TournamentInfo = z.infer<typeof tournamentSchema>;
type ParticipantRow = z.infer<typeof participantsSchema>["data"][number];
type MatchRow = z.infer<typeof matchesSchema>["data"][number];

function linkOnly(t: TournamentInfo, bracketUrl: string): BracketSummary {
  return {
    tournament: t.name,
    bracketUrl,
    rulesUrl: t.rules_url ?? null,
    state: null,
    alive: [],
    eliminated: [],
    recent: [],
    upcoming: [],
    source: "link_only",
    fetchedAt: null,
    degraded: false,
  };
}

// Host <sub>.challonge.com gives a community id; challonge.com gives none.
export function parseBracketUrl(
  raw: string | null | undefined,
): { url: string; communityId: string | null } | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  let communityId: string | null;
  if (host === "challonge.com" || host === "www.challonge.com") communityId = null;
  else if (host.endsWith(".challonge.com")) communityId = host.slice(0, -".challonge.com".length);
  else return null;
  const url = parsed.pathname.split("/").find((s) => s !== "");
  if (!url) return null;
  return { url, communityId };
}

function countKey(): string {
  return keys.cache("challonge", `count-${new Date().toISOString().slice(0, 7)}`);
}

interface PagesResult<T> {
  items: T[] | null; // null: page 1 answered 304, nothing changed
  etag: string | undefined;
}

async function fetchPages<T>(
  path: string,
  communityId: string | null,
  apiKey: string,
  schema: z.ZodType<{ data: T[] }>,
  counter: string,
  etag: string | undefined,
): Promise<PagesResult<T>> {
  const all: T[] = [];
  let newEtag: string | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (communityId !== null) query.set("community_id", communityId);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/vnd.api+json",
      "Authorization-Type": "v1",
      Authorization: apiKey,
    };
    if (page === 1 && etag) headers["If-None-Match"] = etag;
    await kv().incrByFloat(counter, 1, COUNT_TTL_SEC);
    const response = await fetch(`${API}${path}?${query.toString()}`, { headers });
    if (page === 1 && response.status === 304) return { items: null, etag };
    if (!response.ok) throw new ChallongeFailure(response.status);
    if (page === 1) newEtag = response.headers.get("ETag") ?? undefined;
    let items: T[];
    try {
      items = schema.parse(await response.json()).data;
    } catch {
      throw new ChallongeFailure(undefined);
    }
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return { items: all, etag: newEtag };
}

function roundLabel(round: number): string {
  return round < 0 ? `Losers round ${Math.abs(round)}` : `Round ${round}`;
}

function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function build(
  t: TournamentInfo,
  bracketUrl: string,
  participants: ParticipantRow[],
  matches: MatchRow[],
): BracketSummary {
  const names = new Map(participants.map((p) => [p.id, p.attributes.name]));
  const nameOf = (id: string | null | undefined): string | null =>
    id === null || id === undefined ? null : (names.get(id) ?? null);
  const slots = (m: MatchRow): [string | null, string | null] => {
    const rel = m.attributes.relationships ?? m.relationships;
    return [nameOf(rel?.player1?.data?.id), nameOf(rel?.player2?.data?.id)];
  };

  const seed = (p: ParticipantRow): number => p.attributes.seed ?? 0;
  const rank = (p: ParticipantRow): number => p.attributes.final_rank ?? Number.MAX_SAFE_INTEGER;
  const alive = participants
    .filter((p) => p.attributes.states?.active === true)
    .sort((a, b) => seed(a) - seed(b))
    .map((p) => p.attributes.name);
  const eliminated = participants
    .filter((p) => p.attributes.states?.active !== true)
    .sort((a, b) => rank(a) - rank(b) || byName(a.attributes.name, b.attributes.name))
    .map((p) => p.attributes.name);

  const recent: BracketSummary["recent"] = [];
  const complete = matches
    .filter((m) => m.attributes.state === "complete")
    .sort((a, b) => b.attributes.round - a.attributes.round);
  for (const m of complete) {
    const [p1, p2] = slots(m);
    if (p1 === null || p2 === null) continue;
    recent.push({
      round: roundLabel(m.attributes.round),
      players: [p1, p2],
      winner: nameOf(m.attributes.winner_id),
    });
    if (recent.length === MAX_RECENT) break;
  }

  const upcoming = matches
    .filter((m) => m.attributes.state === "open" || m.attributes.state === "pending")
    .sort(
      (a, b) =>
        Math.abs(a.attributes.round) - Math.abs(b.attributes.round) ||
        b.attributes.round - a.attributes.round,
    )
    .map((m) => ({ round: roundLabel(m.attributes.round), players: slots(m) }));

  let state = "pending";
  if (matches.length > 0 && matches.every((m) => m.attributes.state === "complete")) {
    state = "complete";
  } else if (
    matches.some((m) => m.attributes.state === "complete" || m.attributes.state === "open")
  ) {
    state = "underway";
  }

  return {
    tournament: t.name,
    bracketUrl,
    rulesUrl: t.rules_url ?? null,
    state,
    alive,
    eliminated,
    recent,
    upcoming,
    source: "challonge",
    fetchedAt: new Date().toISOString(),
    degraded: false,
  };
}

async function readSnapshot(key: string): Promise<Snapshot | null> {
  const parsed = snapshotSchema.safeParse(await kv().get<unknown>(key));
  return parsed.success ? parsed.data : null;
}

// A missing or unreadable fetchedAt counts as stale, so the snapshot is refreshed.
function snapshotTime(iso: string | null): number | null {
  if (!iso) return null;
  try {
    return parseWizzrobeTime(iso).getTime();
  } catch (err) {
    log("warn", "challonge.bad_fetched_at", { error: String(err) });
    return null;
  }
}

function quietEnd(now: Date): Date {
  return parseUserDateTime(`${communityDate(now)} ${QUIET_UNTIL}`, now).instant;
}

export async function bracketFor(tournamentId: number): Promise<BracketSummary> {
  const bot = await botAccessToken();
  const t = tournamentSchema.parse(
    await callTool(bot, "get_tournament", { tournament_id: tournamentId }),
  );
  const bracketUrl = t.bracket_url ?? "";
  const target = parseBracketUrl(t.bracket_url);
  if (target === null) return linkOnly(t, "");

  const snapKey = keys.cache("challonge", String(tournamentId));
  const snapshot = await readSnapshot(snapKey);
  const fallback = (): BracketSummary => snapshot?.summary ?? linkOnly(t, bracketUrl);

  if (snapshot) {
    const fetchedAt = snapshotTime(snapshot.summary.fetchedAt);
    const now = Date.now();
    const fresh = fetchedAt !== null && now - fetchedAt < MAX_AGE_MS;
    if (fresh) return snapshot.summary;
  }
  // Quiet hours: before 08:00 community time, serve what we have. With no snapshot, fetch once.
  if (snapshot && Date.now() < quietEnd(new Date()).getTime()) return snapshot.summary;

  const apiKey = config().challongeApiKey;
  if (!apiKey) return fallback();

  const counter = countKey();
  const used = Number(await kv().get<number | string>(counter)) || 0;
  if (used >= MONTHLY_LIMIT) {
    log("warn", "challonge.monthly_guard", { used });
    return fallback();
  }

  try {
    const base = `/tournaments/${encodeURIComponent(target.url)}`;
    const get = <T>(
      name: string,
      schema: z.ZodType<{ data: T[] }>,
      etag: string | undefined,
    ): Promise<PagesResult<T>> =>
      fetchPages(`${base}/${name}.json`, target.communityId, apiKey, schema, counter, etag);
    const oldTags = snapshot?.etags;
    let p = await get("participants", participantsSchema, oldTags?.participants);
    let m = await get("matches", matchesSchema, oldTags?.matches);
    if (p.items === null && m.items === null && snapshot) {
      const summary = { ...snapshot.summary, fetchedAt: new Date().toISOString() };
      await kv().set<Snapshot>(snapKey, { summary, etags: snapshot.etags });
      return summary;
    }
    // One list changed and the other did not: the unchanged data is not stored, so refetch it.
    if (p.items === null) p = await get("participants", participantsSchema, undefined);
    if (m.items === null) m = await get("matches", matchesSchema, undefined);
    const summary = build(t, bracketUrl, p.items ?? [], m.items ?? []);
    const etags = {
      ...(p.etag ? { participants: p.etag } : {}),
      ...(m.etag ? { matches: m.etag } : {}),
    };
    await kv().set<Snapshot>(snapKey, { summary, etags });
    return summary;
  } catch (err) {
    log("warn", "challonge.refresh_failed", {
      status: err instanceof ChallongeFailure ? err.status : undefined,
    });
    return { ...fallback(), degraded: true };
  }
}
