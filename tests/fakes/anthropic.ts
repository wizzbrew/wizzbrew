import type {
  BetaContentBlock,
  BetaMessage,
  BetaUsage,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { NotImplemented } from "../../src/errors.js";
import type { AnthropicLike } from "../../src/llm/client.js";

export class FakeAnthropic implements AnthropicLike {
  readonly requests: unknown[] = []; // every create() params, in order

  readonly beta: AnthropicLike["beta"] = {
    messages: {
      create: async (_params) => {
        throw new NotImplemented("FakeAnthropic.beta.messages.create");
      },
    },
  };

  // answered in order; create() on an empty queue throws
  queue(..._msgs: BetaMessage[]): this {
    throw new NotImplemented("FakeAnthropic.queue");
  }
}

export function fakeMessage(
  _content: BetaContentBlock[],
  _opts?: { stop_reason?: string; model?: string; usage?: Partial<BetaUsage> },
): BetaMessage {
  throw new NotImplemented("fakeMessage");
}

export const block: {
  text(text: string): BetaContentBlock;
  thinking(thinking: string): BetaContentBlock;
  toolUse(name: string, input: unknown, id?: string): BetaContentBlock;
  mcpToolUse(name: string, input: unknown, id?: string): BetaContentBlock; // server_name "wizzrobe"
  mcpToolResult(toolUseId: string, text: string, isError?: boolean): BetaContentBlock;
} = {
  text(_text: string): BetaContentBlock {
    throw new NotImplemented("block.text");
  },
  thinking(_thinking: string): BetaContentBlock {
    throw new NotImplemented("block.thinking");
  },
  toolUse(_name: string, _input: unknown, _id?: string): BetaContentBlock {
    throw new NotImplemented("block.toolUse");
  },
  mcpToolUse(_name: string, _input: unknown, _id?: string): BetaContentBlock {
    throw new NotImplemented("block.mcpToolUse");
  },
  mcpToolResult(_toolUseId: string, _text: string, _isError?: boolean): BetaContentBlock {
    throw new NotImplemented("block.mcpToolResult");
  },
};
