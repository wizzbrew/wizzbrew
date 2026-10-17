import { z } from "zod";
import { log } from "../log.js";
import { communityDate, dayWindowUtc, parseUserDate, parseWizzrobeTime } from "../time/time.js";
import type { Answer } from "../types.js";
import { callTool } from "../wizzrobe/mcp.js";
import { resolveByName } from "../wizzrobe/resolve.js";
import { listOf } from "../wizzrobe/shapes.js";
import { botAccessToken } from "../wizzrobe/tokens.js";

// Answers that need no model: what is live, and a plain schedule request, straight from Wizzrobe.

const StageList = listOf(z.object({ name: z.string(), stream_url: z.string().nullish() }));

const TournamentList = listOf(z.object({ name: z.string() }));

const Match = z.object({
  tournament: z.string().nullish(),
  scheduled_at: z.string(),
  status: z.string(),
  players: z.array(z.string()),
  stage: z.string().nullish(),
});

const Schedule = listOf(z.object({ stage: z.string(), matches: z.array(Match) }));

type ScheduledMatch = z.infer<typeof Match> & { stageName: string; at: Date };

const NOW_STATUSES = new Set(["live", "checked_in", "awaiting_result"]);
const NEXT_STATUSES = new Set(["scheduled", "checked_in"]);

async function read<S extends z.ZodTypeAny>(
  schema: S,
  name: string,
  args: Record<string, unknown>,
): Promise<z.infer<S>> {
  const raw = await callTool(await botAccessToken(), name, args);
  return schema.parse(raw);
}

async function loadMatches(date: string): Promise<ScheduledMatch[]> {
  const schedule = await read(Schedule, "get_schedule", { date });
  const out: ScheduledMatch[] = [];
  for (const group of schedule) {
    for (const m of group.matches) {
      out.push({ ...m, stageName: m.stage ?? group.stage, at: parseWizzrobeTime(m.scheduled_at) });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function describeMatch(m: ScheduledMatch): string {
  const players = m.players.join(" vs ");
  return m.tournament ? `${players} (${m.tournament})` : players;
}

function epoch(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

const isUpcoming = (m: ScheduledMatch, now: Date): boolean =>
  m.at.getTime() > now.getTime() && NEXT_STATUSES.has(m.status);

export async function liveAnswer(now: Date): Promise<Answer> {
  const stages = await read(StageList, "list_stages", { active_only: true });
  let matches = await loadMatches(communityDate(now));
  if (matches.filter((m) => isUpcoming(m, now)).length < 2) {
    matches = matches.concat(await loadMatches(parseUserDate("tomorrow", now)));
  }
  log("info", "direct.live", { stages: stages.length, matches: matches.length });

  const blocks = stages.map((stage) => {
    const here = matches.filter((m) => m.stageName === stage.name);
    const current = here.find((m) => NOW_STATUSES.has(m.status));
    const next = here.find((m) => m !== current && isUpcoming(m, now));
    const head = stage.stream_url ? `**${stage.name}** ${stage.stream_url}` : `**${stage.name}**`;
    const nowLine = current ? `Now: ${describeMatch(current)}` : "Now: nothing on";
    const nextLine = next
      ? `Next: ${describeMatch(next)} <t:${epoch(next.at)}:t> (<t:${epoch(next.at)}:R>)`
      : "Next: nothing scheduled";
    return `${head}\n${nowLine}\n${nextLine}`;
  });

  return {
    text: blocks.length > 0 ? blocks.join("\n\n") : "No stages are active right now.",
    ephemeral: false,
  };
}

type Picked = { kind: "ok"; name?: string } | { kind: "answer"; answer: Answer };

function pick<T extends { name: string }>(
  input: string | undefined,
  items: T[],
  noun: string,
): Picked {
  if (input === undefined || input.trim() === "") return { kind: "ok" };
  const r = resolveByName(input, items, (t) => t.name);
  if (r.kind === "match") return { kind: "ok", name: r.value.name };
  if (r.kind === "ambiguous") {
    return {
      kind: "answer",
      answer: {
        text: "Which one?",
        choices: r.options.map((o) => ({ label: o.name, value: o.name })),
        ephemeral: false,
      },
    };
  }
  const names = items.map((i) => i.name).join(", ");
  return {
    kind: "answer",
    answer: {
      text: `I found no ${noun} by that name. The ${noun}s are: ${names}.`,
      ephemeral: false,
    },
  };
}

export async function scheduleAnswer(
  params: { day?: string; stage?: string; tournament?: string },
  now: Date,
): Promise<Answer> {
  const date = params.day === undefined ? communityDate(now) : parseUserDate(params.day, now);

  let stageName: string | undefined;
  if (params.stage !== undefined) {
    const stages = await read(StageList, "list_stages", { active_only: true });
    const p = pick(params.stage, stages, "stage");
    if (p.kind === "answer") return p.answer;
    stageName = p.name;
  }
  let tournamentName: string | undefined;
  if (params.tournament !== undefined) {
    const list = await read(TournamentList, "list_tournaments", { active_only: true });
    const p = pick(params.tournament, list, "tournament");
    if (p.kind === "answer") return p.answer;
    tournamentName = p.name;
  }

  const matches = (await loadMatches(date)).filter(
    (m) =>
      (stageName === undefined || m.stageName === stageName) &&
      (tournamentName === undefined || m.tournament === tournamentName),
  );
  if (matches.length === 0) {
    const start = dayWindowUtc(date).start;
    return { text: `Nothing is scheduled for <t:${epoch(start)}:D>.`, ephemeral: false };
  }

  const order: string[] = [];
  for (const m of matches) if (!order.includes(m.stageName)) order.push(m.stageName);
  const blocks = order.map((name) => {
    const lines = matches
      .filter((m) => m.stageName === name)
      .map((m) => {
        const mark = m.status === "cancelled" ? " (cancelled)" : "";
        return `<t:${epoch(m.at)}:t> ${describeMatch(m)}${mark}`;
      });
    return `**${name}**\n${lines.join("\n")}`;
  });
  return { text: blocks.join("\n\n"), ephemeral: false };
}
