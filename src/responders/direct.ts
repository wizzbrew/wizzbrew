import { NotImplemented } from "../errors.js";
import type { Answer } from "../types.js";

export async function liveAnswer(_now: Date): Promise<Answer> {
  throw new NotImplemented("direct.liveAnswer");
}

export async function scheduleAnswer(
  _params: { day?: string; stage?: string; tournament?: string },
  _now: Date,
): Promise<Answer> {
  throw new NotImplemented("direct.scheduleAnswer");
}
