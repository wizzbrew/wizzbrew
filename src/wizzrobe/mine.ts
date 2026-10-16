import { z } from "zod";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import { parseWizzrobeTime } from "../time/time.js";
import type { Asker } from "../types.js";
import { callTool } from "./mcp.js";
import { botAccessToken } from "./tokens.js";

export interface MyMatch {
  matchId: number;
  tournament: string;
  scheduledAt: Date;
  status: string;
  stage: string | null;
  streamUrl: string | null;
  opponents: string[];
}

export interface MyMatches {
  matches: MyMatch[];
  partial: boolean;
}

const ROSTER_TTL_SEC = 21600;
const MAX_UNCACHED_FETCHES = 20;
const DROPPED_STATUSES = new Set(["cancelled", "canceled", "complete", "completed"]);

const listSchema = z.object({
  result: z.array(
    z.object({
      id: z.number(),
      tournament: z.string(),
      scheduled_at: z.string(),
      status: z.string(),
      players: z.array(z.string()),
      stage: z.string().nullable().optional(),
      restream_url: z.string().nullable().optional(),
    }),
  ),
});
type Listed = z.infer<typeof listSchema>["result"][number];

const getMatchSchema = z.object({
  players: z.array(
    z.object({
      user: z.object({
        display_name: z.string().nullable().optional(),
        username: z.string().nullable().optional(),
        discord_id: z.union([z.string(), z.number()]).nullable().optional(),
      }),
    }),
  ),
});

const rosterSchema = z.object({
  players: z.array(
    z.object({
      name: z.string(),
      discordId: z.union([z.string(), z.number()]).nullable(),
    }),
  ),
});
type Roster = z.infer<typeof rosterSchema>;

async function rosterFor(
  token: string,
  matchId: number,
): Promise<{ roster: Roster; fetched: boolean }> {
  const key = keys.cache("roster", String(matchId));
  const hit = await kv().get<unknown>(key);
  if (hit !== null) {
    const parsed = rosterSchema.safeParse(hit);
    if (parsed.success) return { roster: parsed.data, fetched: false };
  }
  const raw = getMatchSchema.parse(await callTool(token, "get_match", { match_id: matchId }));
  const roster: Roster = {
    players: raw.players.map((p) => ({
      name: p.user.display_name ?? p.user.username ?? "",
      discordId: p.user.discord_id ?? null,
    })),
  };
  await kv().set(key, roster, ROSTER_TTL_SEC);
  return { roster, fetched: true };
}

function toMy(m: Listed, at: Date, opponents: string[]): MyMatch {
  return {
    matchId: m.id,
    tournament: m.tournament,
    scheduledAt: at,
    status: m.status,
    stage: m.stage ?? null,
    streamUrl: m.restream_url ?? null,
    opponents,
  };
}

// The asker's own upcoming matches. One list_matches call; linked askers match by username,
// unlinked ones by the Discord id stored on each player, read from cached rosters.
export async function matchesForAsker(
  asker: Asker,
  window: { start: Date; end: Date },
): Promise<MyMatches | "id_unreliable"> {
  const token = await botAccessToken();
  const listed = listSchema.parse(
    await callTool(token, "list_matches", {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      limit: 200,
    }),
  );
  const open = listed.result
    .filter((m) => !DROPPED_STATUSES.has(m.status.toLowerCase()))
    .map((m) => ({ m, at: parseWizzrobeTime(m.scheduled_at) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (asker.linked) {
    const me = asker.linked.wizzrobeUsername.toLowerCase();
    const matches = open
      .filter(({ m }) => m.players.some((p) => p.toLowerCase() === me))
      .map(({ m, at }) =>
        toMy(
          m,
          at,
          m.players.filter((p) => p.toLowerCase() !== me),
        ),
      );
    return { matches, partial: false };
  }

  const matches: MyMatch[] = [];
  let partial = false;
  let fetches = 0;
  for (const { m, at } of open) {
    const cached = (await kv().get<unknown>(keys.cache("roster", String(m.id)))) !== null;
    if (!cached && fetches >= MAX_UNCACHED_FETCHES) {
      partial = true;
      break;
    }
    const { roster, fetched } = await rosterFor(token, m.id);
    if (fetched) fetches += 1;
    if (roster.players.some((p) => typeof p.discordId === "number")) return "id_unreliable";
    if (roster.players.some((p) => p.discordId === asker.discordUserId)) {
      const opponents = roster.players
        .filter((p) => p.discordId !== asker.discordUserId)
        .map((p) => p.name);
      matches.push(toMy(m, at, opponents));
    }
  }
  return { matches, partial };
}
