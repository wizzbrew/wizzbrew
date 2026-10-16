import { NotImplemented } from "../errors.js";
import type { Answer, Asker } from "../types.js";

export async function accountAnswer(
  _action: "link" | "unlink",
  _asker: Asker,
  _now: Date,
): Promise<Answer> {
  throw new NotImplemented("account.accountAnswer");
}
