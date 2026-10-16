import { APIError } from "@anthropic-ai/sdk";
import { createPending, saveThread } from "../actions/pending.js";
import {
  BudgetExceededError,
  NotLinkedError,
  UserInputError,
  userMessageFor,
  WizzrobeError,
} from "../errors.js";
import { assertUnderBudget } from "../llm/budget.js";
import { clip, log } from "../log.js";
import { alertStaff, isPaused } from "../ops/alerts.js";
import { allowRequest } from "../ops/rate.js";
import { runResponder } from "../responders/base.js";
import { liveAnswer } from "../responders/direct.js";
import { routeQuestion } from "../router/router.js";
import { ROUTES } from "../router/routes.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import type {
  Answer,
  AskContext,
  Asker,
  ConversationTurn,
  ReplyTarget,
  RoutingDecision,
} from "../types.js";
import { accountAnswer } from "./account.js";
import { deliver, deliverError } from "./deliver.js";

export interface PipelineRequest {
  requestId: string;
  asker: Asker;
  question: string;
  reply: ReplyTarget;
  history: ConversationTurn[];
  threadId?: string;
  forced?: RoutingDecision;
  now: Date;
}

const LOCK_TTL_SEC = 300;
const USER_FAULT_STATUSES = new Set([400, 401, 403, 404]);

function isUserFault(err: unknown): boolean {
  if (err instanceof UserInputError) return true;
  if (err instanceof NotLinkedError) return true;
  if (err instanceof BudgetExceededError) return true;
  if (err instanceof APIError && (err.status === 429 || err.status === 529)) return true;
  return err instanceof WizzrobeError && USER_FAULT_STATUSES.has(err.status);
}

function checkAuth(asker: Asker, decision: RoutingDecision): void {
  const auth = ROUTES[decision.route].auth;
  if (auth === "linked" && !asker.linked) throw new NotLinkedError("");
  if (auth === "staff") {
    const roles = asker.linked?.roles ?? [];
    if (!roles.includes("staff") && !roles.includes("admin")) {
      throw new UserInputError("That's for event staff.");
    }
  }
}

async function answerFor(req: PipelineRequest, decision: RoutingDecision): Promise<Answer> {
  const { asker, now } = req;
  if (decision.route === "account") {
    return accountAnswer(decision.params.accountAction ?? "link", asker, now);
  }
  if (decision.route === "live") return liveAnswer(now);
  const ctx: AskContext = {
    requestId: req.requestId,
    asker,
    question: req.question,
    now,
    ephemeral: req.reply.kind === "interaction" && req.reply.ephemeral,
    history: req.history,
  };
  return runResponder(decision.route, decision, ctx);
}

export async function runAskPipeline(req: PipelineRequest): Promise<void> {
  const { requestId, asker, question, reply, history, forced, now } = req;
  const started = Date.now();
  const lockKey = keys.lock(asker.discordUserId);
  let locked = false;
  let route = "none";
  try {
    if (!(await allowRequest(asker.discordUserId, now))) {
      await deliverError(reply, "You're asking faster than I can keep up. Give it a minute.");
      return;
    }
    locked = await kv().setIfAbsent(lockKey, requestId, LOCK_TTL_SEC);
    if (!locked) {
      await deliverError(reply, "Still working on your last one. Ask again in a moment.");
      return;
    }
    if (await isPaused()) {
      await deliverError(reply, "Wizzbrew is paused right now.");
      return;
    }
    if (forced?.route !== "live") await assertUnderBudget(now);

    const decision =
      forced ??
      (await routeQuestion({
        requestId,
        asker,
        question,
        now,
        ephemeral: reply.kind === "interaction" && reply.ephemeral,
        history,
      }));
    route = decision.route;
    checkAuth(asker, decision);

    const answer = await answerFor(req, decision);
    const pending = answer.proposedAction
      ? await createPending(answer.proposedAction, asker.discordUserId, now)
      : undefined;
    const pendingId = pending?.id;

    const held = reply.kind === "message" && answer.ephemeral ? { answer, pendingId } : undefined;
    const thread = await saveThread(
      {
        id: "",
        discordUserId: asker.discordUserId,
        question,
        decision,
        ephemeral: answer.ephemeral,
        turns: [
          ...history,
          { role: "user", text: question },
          {
            role: "assistant",
            text: decision.route === "account" ? "(sent a private account link)" : answer.text,
          },
        ],
        ...(held ? { held } : {}),
      },
      now,
    );

    await deliver(reply, answer, { pendingId, threadId: thread.id });
    log("info", "ask.done", { requestId, route, ms: Date.now() - started, path: reply.kind });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    const status = err instanceof WizzrobeError ? err.status : undefined;
    log("warn", "ask.failed", { requestId, name, status });
    if (!isUserFault(err)) {
      try {
        await alertStaff(
          `ask.${name}`,
          clip(err instanceof Error ? err.message : String(err), 300),
        );
      } catch (alertErr) {
        log("error", "ask.alert_failed", { requestId, error: alertErr });
      }
    }
    await deliverError(reply, userMessageFor(err, { public: reply.kind === "message" }));
  } finally {
    if (locked) {
      try {
        await kv().del(lockKey);
      } catch (delErr) {
        log("error", "ask.unlock_failed", { requestId, error: delErr });
      }
    }
  }
}
