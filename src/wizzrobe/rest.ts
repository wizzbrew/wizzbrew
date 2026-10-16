import { z } from "zod";
import { config } from "../config.js";
import { WizzrobeError } from "../errors.js";

const UNEXPECTED_REPLY = "Wizzrobe sent an unexpected reply";

const nullableInt = z.number().int().nullable();

const rescheduleRequestReply = z
  .object({
    id: z.number().int(),
    match_id: z.number().int(),
    kind: z.string(),
    status: z.string(),
    reason: z.string(),
    requested_by_id: z.number().int(),
    created_at: z.string(),
    proposed_at: z.string().nullable(),
    original_scheduled_at: z.string().nullable(),
    opponent_agreed_at: z.string().nullable(),
    requested_by_name: z.string().nullable(),
    decided_by_id: nullableInt,
    decided_by_name: z.string().nullable(),
    decided_at: z.string().nullable(),
    decision_note: z.string().nullable(),
  })
  .passthrough();

const bracketMatchReply = z
  .object({
    id: z.number().int(),
    bracket_id: z.number().int(),
    round: z.number().int(),
    position: z.number().int(),
    state: z.enum(["pending", "open", "complete"]),
    created_at: z.string(),
    updated_at: z.string(),
    group_number: nullableInt,
    entry1_id: nullableInt,
    entry2_id: nullableInt,
    winner_id: nullableInt,
    entry1_score: nullableInt,
    entry2_score: nullableInt,
    winner_to_id: nullableInt,
    winner_to_slot: nullableInt,
    loser_to_id: nullableInt,
    loser_to_slot: nullableInt,
    best_of: nullableInt,
    forfeit: z.boolean(),
    status: z.string().nullable(),
    games: z.array(z.unknown()),
  })
  .passthrough();

export async function createRescheduleRequest(
  token: string,
  matchId: number,
  body: { kind: "reschedule" | "cancel"; reason: string; proposedAt?: string },
): Promise<unknown> {
  const payload: Record<string, unknown> = { kind: body.kind, reason: body.reason };
  if (body.kind === "reschedule" && body.proposedAt !== undefined) {
    payload.proposed_at = body.proposedAt;
  }
  const reply = await request(
    token,
    "POST",
    `/api/matches/${matchId}/reschedule-requests`,
    payload,
  );
  const parsed = rescheduleRequestReply.safeParse(reply);
  if (!parsed.success) throw unexpectedReply();
  return parsed.data;
}

export async function bookBracketGame(
  token: string,
  bracketMatchId: number,
  body: { scheduledDate: string; scheduledTime: string; comment?: string },
): Promise<unknown> {
  const payload: Record<string, unknown> = {
    scheduled_date: body.scheduledDate,
    scheduled_time: body.scheduledTime,
  };
  if (body.comment !== undefined) payload.comment = body.comment;
  const reply = await request(
    token,
    "POST",
    `/api/brackets/matches/${bracketMatchId}/games`,
    payload,
  );
  const parsed = bracketMatchReply.safeParse(reply);
  if (!parsed.success) throw unexpectedReply();
  return parsed.data;
}

export async function myOpenBracketMatches(
  token: string,
  tournamentId?: number,
): Promise<unknown[]> {
  const query = tournamentId === undefined ? "" : `?tournament_id=${tournamentId}`;
  const reply = await request(token, "GET", `/api/brackets/my-open-matches${query}`);
  const parsed = z.array(bracketMatchReply).safeParse(reply);
  if (!parsed.success) throw unexpectedReply();
  return parsed.data;
}

async function request(
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const base = config().wizzrobeBaseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new WizzrobeError(503, "could not reach Wizzrobe");
  }

  const payload = await readJson(res);
  if (!res.ok) throw failure(res, payload);
  return payload;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function failure(res: Response, payload: unknown): WizzrobeError {
  const retryAfterSec = retryAfterSeconds(res);
  const detail = isRecord(payload) ? payload.detail : undefined;
  const fallback = res.statusText || `HTTP ${res.status}`;

  if (res.status === 422) {
    const messages = Array.isArray(detail)
      ? detail.flatMap((item: unknown) =>
          isRecord(item) && typeof item.msg === "string" ? [item.msg] : [],
        )
      : [];
    return new WizzrobeError(
      400,
      messages.length > 0 ? messages.join("; ") : fallback,
      retryAfterSec,
    );
  }

  const message = typeof detail === "string" && detail !== "" ? detail : fallback;
  return new WizzrobeError(res.status, message, retryAfterSec);
}

function retryAfterSeconds(res: Response): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (raw === null || raw.trim() === "") return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function unexpectedReply(): WizzrobeError {
  return new WizzrobeError(502, UNEXPECTED_REPLY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
