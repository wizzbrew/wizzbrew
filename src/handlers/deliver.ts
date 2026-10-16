import { NotImplemented } from "../errors.js";
import type { Answer, ReplyTarget } from "../types.js";

export async function deliver(
  _target: ReplyTarget,
  _answer: Answer,
  _ids: { pendingId?: string; threadId?: string },
): Promise<void> {
  throw new NotImplemented("deliver.deliver");
}

export async function deliverError(_target: ReplyTarget, _message: string): Promise<void> {
  throw new NotImplemented("deliver.deliverError");
}
