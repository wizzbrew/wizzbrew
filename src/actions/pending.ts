import { NotImplemented } from "../errors.js";
import type { PendingAction, ProposedAction, ThreadRecord } from "../types.js";

export async function createPending(
  _a: ProposedAction,
  _discordUserId: string,
  _now: Date,
): Promise<PendingAction> {
  throw new NotImplemented("pending.createPending");
}

export async function takePending(
  _id: string,
  _discordUserId: string,
  _now: Date,
): Promise<PendingAction | "expired" | "not_yours"> {
  throw new NotImplemented("pending.takePending");
}

export async function saveThread(
  _t: Omit<ThreadRecord, "createdAt" | "expiresAt">,
  _now: Date,
): Promise<ThreadRecord> {
  throw new NotImplemented("pending.saveThread");
}

export async function loadThread(
  _id: string,
  _discordUserId: string,
  _now: Date,
): Promise<ThreadRecord | "expired" | "not_yours"> {
  throw new NotImplemented("pending.loadThread");
}
