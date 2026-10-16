import { NotImplemented } from "../errors.js";
import type { RelayMessage } from "../types.js";

export async function runMessagePipeline(
  _m: RelayMessage,
  _requestId: string,
  _now: Date,
): Promise<void> {
  throw new NotImplemented("message.runMessagePipeline");
}
