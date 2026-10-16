import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";

const PER_MINUTE = 8;
const PER_HOUR = 60;

// Per-user request limiter: 8 a minute and 60 an hour. Both counters always tick.
export async function allowRequest(discordUserId: string, now: Date): Promise<boolean> {
  const minute = Math.floor(now.getTime() / 60_000);
  const hour = Math.floor(now.getTime() / 3_600_000);
  const m = await kv().incrByFloat(keys.cache("rate", `m-${discordUserId}-${minute}`), 1, 120);
  const h = await kv().incrByFloat(keys.cache("rate", `h-${discordUserId}-${hour}`), 1, 7200);
  return m <= PER_MINUTE && h <= PER_HOUR;
}
