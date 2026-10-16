import { config } from "../config.js";
import { discordApi } from "../discord/api.js";
import { clip, log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";

const ALERT_TTL_SEC = 600;
const DETAIL_MAX = 300;

// Posts to the staff channel, at most once per event per 10 minutes. Never throws.
export async function alertStaff(event: string, detail: string): Promise<void> {
  try {
    const name = event
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "_")
      .slice(0, 64);
    log("warn", "staff.alert", { event: name });
    const channelId = config().staffAlertChannelId;
    if (!channelId) return;
    const first = await kv().setIfAbsent(keys.alert(name), 1, ALERT_TTL_SEC);
    if (!first) return;
    await discordApi().postMessage(channelId, {
      content: `Wizzbrew alert: ${name}\n${clip(detail, DETAIL_MAX)}`,
      allowed_mentions: { parse: [] },
    });
  } catch (err) {
    log("error", "staff.alert_failed", { error: err });
  }
}

// A Redis error propagates; callers decide what to do.
export async function isPaused(): Promise<boolean> {
  return (await kv().get(keys.kill())) !== null;
}
