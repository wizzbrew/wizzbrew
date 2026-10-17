import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { config } from "../config.js";
import { ModelOutputError } from "../errors.js";
import { log } from "../log.js";
import { assertUnderBudget, recordSpend } from "./budget.js";
import { MODELS } from "./models.js";

export type BetaMessageCreateParams = MessageCreateParamsNonStreaming;

export type Purpose = keyof typeof MODELS;

export interface AnthropicLike {
  beta: {
    messages: {
      create(
        params: BetaMessageCreateParams & { betas?: string[] },
        options?: { timeout?: number },
      ): Promise<BetaMessage>;
    };
  };
}

// L9: a thinking block or a long tool loop needs room, so never ask for less.
const MIN_MAX_TOKENS = 4000;

let client: AnthropicLike | null = null;

function anthropic(): AnthropicLike {
  if (client === null) {
    client = new Anthropic({
      apiKey: config().anthropicApiKey,
      timeout: 120000, // Vercel stops the function at 300 s
      maxRetries: 1,
    });
  }
  return client;
}

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

// The API's own validation text (error type and message), never prompt or user text (L16, L24).
function apiErrorDetail(err: unknown): { errType?: string; errMsg?: string } {
  if (typeof err !== "object" || err === null) return {};
  const e = err as { error?: { error?: { type?: unknown; message?: unknown } }; message?: unknown };
  const inner = e.error?.error;
  const type = typeof inner?.type === "string" ? inner.type : undefined;
  const msg = typeof inner?.message === "string" ? inner.message : e.message;
  return {
    errType: type,
    errMsg: typeof msg === "string" ? msg.slice(0, 300) : undefined,
  };
}

export async function createMessage(
  purpose: Purpose,
  params: Omit<BetaMessageCreateParams, "model"> & { betas?: string[] },
  ctx: { requestId: string; now: Date; deadline?: number },
): Promise<BetaMessage> {
  let timeout: number | undefined;
  if (ctx.deadline !== undefined) {
    const remaining = ctx.deadline - Date.now();
    if (remaining <= 0) throw new ModelOutputError("timeout", "that took too long");
    timeout = Math.min(120000, remaining);
  }
  await assertUnderBudget(ctx.now);

  const model = MODELS[purpose];
  const max_tokens = Math.max(params.max_tokens ?? MIN_MAX_TOKENS, MIN_MAX_TOKENS);

  let msg: BetaMessage;
  try {
    msg = await anthropic().beta.messages.create(
      { ...params, model, max_tokens },
      timeout === undefined ? undefined : { timeout },
    );
  } catch (err) {
    // L16: SDK errors propagate unchanged. Log context first, never the prompt.
    log("warn", "anthropic.error", {
      requestId: ctx.requestId,
      purpose,
      status: statusOf(err),
      ...apiErrorDetail(err),
    });
    throw err;
  }

  // L12: price by the model that answered, not the one requested.
  const usd = await recordSpend(msg.model, msg.usage, ctx.now, MODELS[purpose]);

  // L24: usage and ids only. Never message text or the prompt. log() redacts any key that
  // matches /token/i, so the counts use "tok" and not "tokens" or they would log as [redacted].
  log("info", "anthropic.call", {
    requestId: ctx.requestId,
    purpose,
    model: msg.model,
    stop_reason: msg.stop_reason,
    input_tok: msg.usage.input_tokens,
    output_tok: msg.usage.output_tokens,
    cache_read_tok: msg.usage.cache_read_input_tokens,
    cache_creation_tok: msg.usage.cache_creation_input_tokens,
    usd,
  });

  if (msg.stop_reason === "refusal") {
    throw new ModelOutputError("refusal", "the model declined this request");
  }
  if (msg.stop_reason === "max_tokens") {
    throw new ModelOutputError("max_tokens", "the answer ran past max_tokens");
  }
  return msg;
}

// L9: read blocks by type, never content[0] (a thinking block may come first).
export function textOf(msg: BetaMessage): string {
  let out = "";
  for (const b of msg.content) {
    if (b.type === "text") out += b.text;
  }
  return out.trim();
}

export function setAnthropicForTests(c: AnthropicLike | null): void {
  client = c;
}
