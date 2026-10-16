import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import { executeAction } from "../actions/execute.js";
import { loadThread, takePending } from "../actions/pending.js";
import { discordApi } from "../discord/api.js";
import { decodeCustomId } from "../discord/components.js";
import { renderAnswer } from "../discord/render.js";
import { userMessageFor } from "../errors.js";
import { log } from "../log.js";
import { loadAsker } from "../wizzrobe/identity.js";
import { runAskPipeline } from "./ask.js";

const NO_MENTIONS = { parse: [] as string[] };
const FLAG_EPHEMERAL = 64;
const EXPIRED = "That request expired. Ask again.";

function edit(token: string, content: string): Promise<void> {
  return discordApi().editOriginal(token, {
    content,
    components: [],
    allowed_mentions: NO_MENTIONS,
  });
}

function privateFollowup(token: string, content: string): Promise<void> {
  return discordApi().followup(token, {
    content,
    flags: FLAG_EPHEMERAL,
    allowed_mentions: NO_MENTIONS,
  });
}

async function handle(
  i: APIMessageComponentInteraction,
  requestId: string,
  now: Date,
): Promise<void> {
  const token = i.token;
  const presser = (i.member?.user ?? i.user)?.id ?? "";
  const action = decodeCustomId(i.data.custom_id);
  if (action === null) {
    await privateFollowup(token, "That button isn't mine.");
    return;
  }

  if (action.kind === "confirm" || action.kind === "cancel") {
    const taken = await takePending(action.pendingId, presser, now);
    if (taken === "not_yours") {
      await privateFollowup(token, "Only the person who asked can confirm this.");
      return;
    }
    if (taken === "expired") {
      await edit(token, EXPIRED);
      return;
    }
    if (action.kind === "cancel") {
      await edit(token, "Cancelled.");
      return;
    }
    await edit(token, "Working on it...");
    const line = await executeAction(taken);
    await edit(token, line);
    return;
  }

  if (action.kind === "choose") {
    const thread = await loadThread(action.threadId, presser, now);
    if (thread === "not_yours") {
      await privateFollowup(token, "That one is private.");
      return;
    }
    if (thread === "expired") {
      await edit(token, EXPIRED);
      return;
    }
    await runAskPipeline({
      requestId,
      asker: await loadAsker(i),
      question: `${thread.question}\n(Picked: ${action.value})`,
      reply: { kind: "interaction", token, ephemeral: thread.ephemeral },
      history: thread.turns,
      threadId: thread.id,
      forced: thread.decision,
      now,
    });
    return;
  }

  if (action.kind === "private") {
    const thread = await loadThread(action.threadId, presser, now);
    if (thread === "not_yours") {
      await edit(token, "That one is just for the person who asked.");
      return;
    }
    if (thread === "expired" || thread.held === undefined) {
      await edit(token, "Nothing is waiting here anymore. Ask again.");
      return;
    }
    const held = thread.held;
    const [first, ...rest] = renderAnswer(held.answer, {
      pendingId: held.pendingId,
      threadId: action.threadId,
    });
    if (first === undefined) return;
    await discordApi().editOriginal(token, first);
    for (const p of rest) {
      await discordApi().followup(token, { ...p, flags: FLAG_EPHEMERAL });
    }
    return;
  }

  // followup and change buttons are not handled here
  await privateFollowup(token, "That button isn't mine.");
}

export async function runComponent(
  i: APIMessageComponentInteraction,
  requestId: string,
  now: Date,
): Promise<void> {
  try {
    await handle(i, requestId, now);
  } catch (err) {
    log("error", "component.failed", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      await edit(i.token, userMessageFor(err));
    } catch (err2) {
      log("error", "component.edit_failed", {
        requestId,
        error: err2 instanceof Error ? err2.message : String(err2),
      });
    }
  }
}
