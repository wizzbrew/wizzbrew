import type { BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { NotImplemented } from "../errors.js";

export async function assertUnderBudget(_now: Date): Promise<void> {
  throw new NotImplemented("budget.assertUnderBudget");
}

export async function recordSpend(_model: string, _usage: BetaUsage, _now: Date): Promise<number> {
  throw new NotImplemented("budget.recordSpend");
}
