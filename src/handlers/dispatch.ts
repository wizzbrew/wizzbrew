import type {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
} from "discord-api-types/v10";
import { loadThread, saveThread, takePending } from "../actions/pending.js";
import { configFor } from "../config.js";
import { OWNER_COMMANDS } from "../discord/commands.js";
import { decodeCustomId, encodeCustomId } from "../discord/components.js";
import { helpText } from "../discord/help.js";
import { normalizeInput } from "../discord/markup.js";
import { userMessageFor } from "../errors.js";
import { log } from "../log.js";
import { isPaused } from "../ops/alerts.js";
import { allowRequest } from "../ops/rate.js";
import { scheduleAnswer } from "../responders/direct.js";
import type { ReplyTarget, RoutingDecision } from "../types.js";
import { loadAsker } from "../wizzrobe/identity.js";
import { runAskPipeline } from "./ask.js";
import { runComponent } from "./component.js";
import { deliver, deliverError } from "./deliver.js";
import { runDmLogCommand } from "./dmlog.js";
import { shortcutRequest } from "./shortcuts.js";

const EPHEMERAL = 64;
const NO_MENTIONS = { parse: [] as string[] };
const PRIVATE_COMMANDS = new Set(["link", "unlink", "me", "help", "dmlog"]);
const KNOWN_COMMANDS = new Set([
  "ask",
  "schedule",
  "live",
  "standings",
  "player",
  "link",
  "unlink",
  "me",
  "help",
  "dmlog",
]);

type Waiter = (p: Promise<unknown>) => void;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function say(content: string): Response {
  return json({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS } });
}

function modal(threadId: string, title: string): Response {
  return json({
    type: 9,
    data: {
      custom_id: encodeCustomId({ kind: "followup", threadId }),
      title,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "question",
              label: "Your follow-up",
              style: 2,
              max_length: 500,
              required: true,
            },
          ],
        },
      ],
    },
  });
}

async function runCommand(
  i: APIChatInputApplicationCommandInteraction,
  target: ReplyTarget,
  requestId: string,
  now: Date,
): Promise<void> {
  const name = i.data.name;
  try {
    const asker = await loadAsker(i);
    const base = { requestId, asker, reply: target, history: [], now };
    if (name === "ask") {
      const opt = (i.data.options ?? []).find((o) => o.name === "question");
      const raw = opt && "value" in opt && typeof opt.value === "string" ? opt.value : "";
      await runAskPipeline({ ...base, question: normalizeInput(raw, i.data.resolved) });
    } else if (name === "link" || name === "unlink") {
      const forced: RoutingDecision = {
        route: "account",
        confidence: 1,
        params: { accountAction: name },
        reason: `shortcut /${name}`,
      };
      await runAskPipeline({ ...base, question: `/${name}`, forced });
    } else {
      const sc = shortcutRequest(i, now);
      if (!sc) throw new Error(`no shortcut for /${name}`);
      if (name === "schedule") {
        const { day, stage, tournament } = sc.decision.params;
        if (!(await allowRequest(asker.discordUserId, now))) {
          await deliverError(target, "You're asking faster than I can keep up. Give it a minute.");
          return;
        }
        const answer = await scheduleAnswer({ day, stage, tournament }, now);
        if (answer.choices !== undefined && answer.choices.length > 0) {
          const thread = await saveThread(
            {
              id: "",
              discordUserId: asker.discordUserId,
              question: sc.question,
              decision: sc.decision,
              ephemeral: false,
              turns: [],
            },
            now,
          );
          await deliver(target, answer, { threadId: thread.id });
        } else {
          await deliver(target, answer, {});
        }
      } else {
        await runAskPipeline({ ...base, question: sc.question, forced: sc.decision });
      }
    }
  } catch (err) {
    await deliverError(
      target,
      userMessageFor(err, { public: !(target.kind === "interaction" && target.ephemeral) }),
    );
  }
}

function isOwner(i: APIChatInputApplicationCommandInteraction): boolean {
  const user = i.member?.user ?? i.user;
  return user !== undefined && configFor("ownerDiscordIds").ownerDiscordIds.includes(user.id);
}

async function handleCommand(
  i: APIChatInputApplicationCommandInteraction,
  requestId: string,
  now: Date,
  waitUntil: Waiter,
): Promise<Response> {
  // First, before the kill switch read: a refused caller costs no Redis command at all.
  if (OWNER_COMMANDS.has(i.data.name) && !isOwner(i)) {
    return say("That command is for the bot's owner.");
  }
  if (await isPaused()) return say("Wizzbrew is paused right now.");
  if (!KNOWN_COMMANDS.has(i.data.name)) return say("I don't know that command.");
  // Static text: answered in the interaction response itself, with no deferral and no model call.
  if (i.data.name === "help") return say(helpText());
  const ephemeral = PRIVATE_COMMANDS.has(i.data.name);
  const target: ReplyTarget = { kind: "interaction", token: i.token, ephemeral };
  // Owner commands that read Redis and call no model: defer privately, then edit the reply.
  if (i.data.name === "dmlog") waitUntil(runDmLogCommand(i, target, now));
  else waitUntil(runCommand(i, target, requestId, now));
  return json({ type: 5, data: { flags: ephemeral ? EPHEMERAL : 0 } });
}

async function handleComponent(
  i: APIMessageComponentInteraction,
  requestId: string,
  now: Date,
  waitUntil: Waiter,
): Promise<Response> {
  const a = decodeCustomId(i.data.custom_id);
  const presser = i.member?.user ?? i.user;
  if (!a || !presser) return say("That button isn't mine.");

  if (a.kind === "followup") {
    const thread = await loadThread(a.threadId, presser.id, now);
    if (thread === "expired") return say("That conversation expired. Ask again.");
    if (thread === "not_yours") return say("That conversation is private.");
    return modal(thread.id, "Ask a follow-up");
  }
  if (a.kind === "change") {
    const pending = await takePending(a.pendingId, presser.id, now);
    if (pending === "not_yours") return say("Only the person who asked can change this.");
    if (pending === "expired") return say("That request expired. Ask again.");
    return modal(a.threadId, "What should change?");
  }
  if (a.kind === "confirm" && (await isPaused())) return say("Wizzbrew is paused right now.");
  if (a.kind === "choose") {
    const thread = await loadThread(a.threadId, presser.id, now);
    if (thread === "expired") return say("That request expired. Ask again.");
    if (thread === "not_yours") return say("That one is private.");
    if (thread.discordUserId !== presser.id) {
      // Someone else's pick on a public thread gets its own private reply.
      waitUntil(runComponent(i, requestId, now));
      return json({ type: 5, data: { flags: EPHEMERAL } });
    }
  }
  waitUntil(runComponent(i, requestId, now));
  if (a.kind === "private") return json({ type: 5, data: { flags: EPHEMERAL } });
  return json({ type: 6 });
}

async function handleModal(
  i: APIModalSubmitInteraction,
  requestId: string,
  now: Date,
  waitUntil: Waiter,
): Promise<Response> {
  const a = decodeCustomId(i.data.custom_id);
  const presser = i.member?.user ?? i.user;
  if (a?.kind !== "followup" || !presser) return say("That form isn't mine.");

  let question = "";
  for (const row of i.data.components) {
    for (const c of "components" in row ? row.components : []) {
      if (c.custom_id === "question" && "value" in c) question = c.value;
    }
  }
  if (question.trim() === "") return say("Type a question first.");

  const thread = await loadThread(a.threadId, presser.id, now);
  if (thread === "expired") return say("That conversation expired. Ask again.");
  if (thread === "not_yours") return say("That conversation is private.");

  const reply: ReplyTarget = { kind: "interaction", token: i.token, ephemeral: thread.ephemeral };
  waitUntil(
    (async () => {
      try {
        await runAskPipeline({
          requestId,
          asker: await loadAsker(i),
          question: normalizeInput(question),
          reply,
          history: thread.turns,
          threadId: thread.id,
          now,
        });
      } catch (err) {
        await deliverError(reply, userMessageFor(err, { public: !reply.ephemeral }));
      }
    })(),
  );
  return json({ type: 5, data: { flags: thread.ephemeral ? EPHEMERAL : 0 } });
}

export async function handleInteraction(i: APIInteraction, waitUntil: Waiter): Promise<Response> {
  const requestId = crypto.randomUUID();
  const now = new Date();
  try {
    switch (i.type as number) {
      case 1:
        return json({ type: 1 });
      case 2:
        return await handleCommand(
          i as APIChatInputApplicationCommandInteraction,
          requestId,
          now,
          waitUntil,
        );
      case 3:
        return await handleComponent(
          i as APIMessageComponentInteraction,
          requestId,
          now,
          waitUntil,
        );
      case 5:
        return await handleModal(i as APIModalSubmitInteraction, requestId, now, waitUntil);
      default:
        return new Response("Bad request", { status: 400 });
    }
  } catch (err) {
    log("error", "dispatch.failed", {
      requestId,
      name: err instanceof Error ? err.name : "unknown",
      error: userMessageFor(err),
    });
    return say("Something went wrong on my side. Try again in a minute.");
  }
}
