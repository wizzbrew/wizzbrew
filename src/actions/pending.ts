import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import type { PendingAction, ProposedAction, ThreadRecord } from "../types.js";

const TTL_SEC = 600;
const TTL_MS = TTL_SEC * 1000;
const THREAD_TTL_SEC = 1800;
const THREAD_TTL_MS = THREAD_TTL_SEC * 1000;
const MAX_TURNS = 6;
const MAX_TURN_CHARS = 1500;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 12;

// 12 characters from [A-Za-z0-9]. Bytes at or above 248 are skipped so the pick is unbiased.
function newId(): string {
  let out = "";
  while (out.length < ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2));
    for (const b of bytes) {
      if (b < 248 && out.length < ID_LENGTH) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export async function createPending(
  a: ProposedAction,
  discordUserId: string,
  now: Date,
): Promise<PendingAction> {
  const record: PendingAction = {
    tool: a.tool,
    args: a.args,
    summary: a.summary,
    id: newId(),
    discordUserId,
    createdAt: now.getTime(),
    expiresAt: now.getTime() + TTL_MS,
  };
  await kv().set(keys.pending(record.id), record, TTL_SEC);
  return record;
}

export async function takePending(
  id: string,
  discordUserId: string,
  now: Date,
): Promise<PendingAction | "expired" | "not_yours"> {
  const record = await kv().get<PendingAction>(keys.pending(id));
  if (record === null || record.expiresAt <= now.getTime()) return "expired";
  if (record.discordUserId !== discordUserId) return "not_yours";
  await kv().del(keys.pending(id));
  return record;
}

export async function saveThread(
  t: Omit<ThreadRecord, "createdAt" | "expiresAt">,
  now: Date,
): Promise<ThreadRecord> {
  const record: ThreadRecord = {
    ...t,
    turns: t.turns.slice(-MAX_TURNS).map((x) => ({ ...x, text: x.text.slice(0, MAX_TURN_CHARS) })),
    id: newId(),
    createdAt: now.getTime(),
    expiresAt: now.getTime() + THREAD_TTL_MS,
  };
  await kv().set(keys.thread(record.id), record, THREAD_TTL_SEC);
  return record;
}

export async function loadThread(
  id: string,
  discordUserId: string,
  now: Date,
): Promise<ThreadRecord | "expired" | "not_yours"> {
  const record = await kv().get<ThreadRecord>(keys.thread(id));
  if (record === null || record.expiresAt <= now.getTime()) return "expired";
  if (record.discordUserId !== discordUserId) return "not_yours";
  const slid: ThreadRecord = { ...record, expiresAt: now.getTime() + THREAD_TTL_MS };
  await kv().set(keys.thread(id), slid, THREAD_TTL_SEC);
  return slid;
}
