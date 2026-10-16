import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { NotImplemented } from "../errors.js";
import type { MODELS } from "./models.js";

export type BetaMessageCreateParams = MessageCreateParamsNonStreaming;

export type Purpose = keyof typeof MODELS;

export interface AnthropicLike {
  beta: {
    messages: {
      create(params: BetaMessageCreateParams & { betas?: string[] }): Promise<BetaMessage>;
    };
  };
}

export async function createMessage(
  _purpose: Purpose,
  _params: Omit<BetaMessageCreateParams, "model"> & { betas?: string[] },
  _ctx: { requestId: string; now: Date },
): Promise<BetaMessage> {
  throw new NotImplemented("client.createMessage");
}

export function textOf(_msg: BetaMessage): string {
  throw new NotImplemented("client.textOf");
}

export function setAnthropicForTests(_c: AnthropicLike | null): void {
  throw new NotImplemented("client.setAnthropicForTests");
}
