import { configFor } from "../config.js";
import { normalizeInput, sanitizeForPrompt } from "../discord/markup.js";
import { userMessageFor } from "../errors.js";
import { log } from "../log.js";
import { dmCount, recordDm } from "../store/dmlog.js";
import { communityDate } from "../time/time.js";
import type { ConversationTurn, RelayMessage, ReplyTarget } from "../types.js";
import { loadAskerFromMessage } from "../wizzrobe/identity.js";
import { runAskPipeline } from "./ask.js";
import { deliverError } from "./deliver.js";

const HISTORY_MAX = 10;
const TURN_MAX_CHARS = 600;
const EMPTY_MENTION = "(the asker mentioned you without saying anything else)";
const RATE_LIMITED = "rate_limited";

export function dmLimitMessage(limit: number): string {
  return `You've reached today's DM limit of ${limit}. The channel is the normal place to ask, so ask there instead.`;
}

function historyFrom(m: RelayMessage): ConversationTurn[] {
  return m.chain.slice(-HISTORY_MAX).map((c) => {
    const content = normalizeInput(c.content);
    return c.isBot
      ? { role: "assistant", text: sanitizeForPrompt(content, TURN_MAX_CHARS) }
      : {
          role: "user",
          text: sanitizeForPrompt(`${c.authorName}: ${content}`, TURN_MAX_CHARS),
        };
  });
}

// The DM log must never break an answer: a failure to record is a warning, not an error (L16).
async function recordSafely(
  requestId: string,
  entry: Parameters<typeof recordDm>[0],
): Promise<void> {
  try {
    await recordDm(entry);
  } catch (err) {
    log("warn", "dm.record_failed", {
      requestId,
      askerId: entry.userId,
      route: entry.route,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function runMessagePipeline(
  m: RelayMessage,
  requestId: string,
  now: Date,
): Promise<void> {
  const target: ReplyTarget = { kind: "message", channelId: m.channelId, messageId: m.messageId };
  try {
    const question = sanitizeForPrompt(normalizeInput(m.content), 500).trim() || EMPTY_MENTION;
    const day = communityDate(now);
    if (m.isDm) {
      const { dmDailyLimit } = configFor("dmDailyLimit");
      const used = await dmCount(day, m.author.id);
      if (used >= dmDailyLimit) {
        await deliverError(target, dmLimitMessage(dmDailyLimit));
        log("info", "dm.rate_limited", {
          requestId,
          askerId: m.author.id,
          used,
          limit: dmDailyLimit,
        });
        await recordSafely(requestId, {
          day,
          userId: m.author.id,
          userName: m.author.nick ?? m.author.globalName ?? m.author.username,
          question,
          route: RATE_LIMITED,
          response: "",
        });
        return;
      }
    }
    const asker = await loadAskerFromMessage(m);
    const result = await runAskPipeline({
      requestId,
      asker,
      question,
      reply: target,
      history: historyFrom(m),
      now,
    });
    if (m.isDm && result) {
      await recordSafely(requestId, {
        day,
        userId: asker.discordUserId,
        userName: asker.discordName,
        question,
        route: result.route,
        response: result.text,
      });
    }
  } catch (err) {
    log("error", "message.pipeline_failed", {
      requestId,
      error: err instanceof Error ? err.message : "unknown",
    });
    try {
      await deliverError(target, userMessageFor(err, { public: true }));
    } catch (deliverErr) {
      log("error", "message.deliver_error_failed", {
        requestId,
        error: deliverErr instanceof Error ? deliverErr.message : "unknown",
      });
    }
  }
}
