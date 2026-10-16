import { discordApi } from "../discord/api.js";
import { renderAnswer, renderError, renderPrivateStub } from "../discord/render.js";
import { log } from "../log.js";
import type { Answer, ReplyTarget } from "../types.js";

const PRIVATE_FLAG = 64;

export async function deliver(
  target: ReplyTarget,
  answer: Answer,
  ids: { pendingId?: string; threadId?: string },
): Promise<void> {
  const api = discordApi();
  if (target.kind === "interaction") {
    const payloads = renderAnswer(answer, ids);
    if (answer.ephemeral && !target.ephemeral) {
      await api.editOriginal(target.token, {
        content: "I sent you the answer privately.",
        embeds: [],
        components: [],
        allowed_mentions: { parse: [] },
      });
      for (const p of payloads) {
        await api.followup(target.token, { ...p, flags: PRIVATE_FLAG });
      }
      return;
    }
    const [first, ...rest] = payloads;
    await api.editOriginal(target.token, first);
    for (const p of rest) {
      await api.followup(target.token, target.ephemeral ? { ...p, flags: PRIVATE_FLAG } : p);
    }
    return;
  }
  if (answer.ephemeral) {
    if (ids.threadId === undefined) {
      throw new Error("deliver.deliver: threadId is required for a private message reply");
    }
    await api.postMessage(target.channelId, renderPrivateStub(ids.threadId), target.messageId);
    return;
  }
  const [first, ...rest] = renderAnswer(answer, ids);
  await api.postMessage(target.channelId, first, target.messageId);
  for (const p of rest) {
    await api.postMessage(target.channelId, p);
  }
}

export async function deliverError(target: ReplyTarget, message: string): Promise<void> {
  try {
    if (target.kind === "interaction") {
      await discordApi().editOriginal(target.token, renderError(message, target.ephemeral));
    } else {
      await discordApi().postMessage(
        target.channelId,
        { content: message, allowed_mentions: { parse: [] } },
        target.messageId,
      );
    }
  } catch (err) {
    log("error", "deliver.failed", { error: err });
  }
}
