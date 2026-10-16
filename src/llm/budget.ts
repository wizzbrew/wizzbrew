import type { BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { config } from "../config.js";
import { BudgetExceededError } from "../errors.js";
import { log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import { communityDate } from "../time/time.js";
import { PRICING } from "./models.js";

const SPEND_TTL_SEC = 172800; // 48 h, so yesterday's counter outlives the community day

export async function assertUnderBudget(now: Date): Promise<void> {
  const spent = Number((await kv().get(keys.spend(communityDate(now)))) ?? 0);
  if (spent >= config().anthropicDailyBudgetUsd) {
    throw new BudgetExceededError("daily Anthropic budget reached");
  }
}

export async function recordSpend(
  model: string,
  usage: BetaUsage,
  now: Date,
  fallbackModel?: string,
): Promise<number> {
  let price = PRICING[model];
  if (price === undefined) {
    const fallback = fallbackModel === undefined ? undefined : PRICING[fallbackModel];
    if (fallback === undefined) {
      throw new Error(`no pricing for ${model}`);
    }
    log("warn", "budget.unknown_model", { model });
    price = fallback;
  }
  const usd =
    (usage.input_tokens * price.inPerM +
      usage.output_tokens * price.outPerM +
      (usage.cache_read_input_tokens ?? 0) * price.cacheReadPerM +
      (usage.cache_creation_input_tokens ?? 0) * price.cacheWritePerM) /
    1e6;
  await kv().incrByFloat(keys.spend(communityDate(now)), usd, SPEND_TTL_SEC);
  return usd;
}
