import { normalizeInput, sanitizeForPrompt } from "../discord/markup.js";
import { userMessageFor } from "../errors.js";
import { log } from "../log.js";
import type { ConversationTurn, RelayMessage, ReplyTarget } from "../types.js";
import { loadAskerFromMessage } from "../wizzrobe/identity.js";
import { runAskPipeline } from "./ask.js";
import { deliverError } from "./deliver.js";

const HISTORY_MAX = 10;
const TURN_MAX_CHARS = 600;
const EMPTY_MENTION = "(the asker mentioned you without saying anything else)";

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

export async function runMessagePipeline(
  m: RelayMessage,
  requestId: string,
  now: Date,
): Promise<void> {
  const target: ReplyTarget = { kind: "message", channelId: m.channelId, messageId: m.messageId };
  try {
    const asker = await loadAskerFromMessage(m);
    const question = sanitizeForPrompt(normalizeInput(m.content), 500).trim() || EMPTY_MENTION;
    await runAskPipeline({
      requestId,
      asker,
      question,
      reply: target,
      history: historyFrom(m),
      now,
    });
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
