import { NotImplemented } from "../errors.js";
import type { PendingAction } from "../types.js";

export async function executeAction(_p: PendingAction): Promise<string> {
  throw new NotImplemented("execute.executeAction");
}
