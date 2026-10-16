import type {
  BetaContentBlock,
  BetaMCPToolResultBlock,
  BetaMCPToolUseBlock,
  BetaMessage,
  BetaStopReason,
  BetaTextBlock,
  BetaThinkingBlock,
  BetaToolUseBlock,
  BetaUsage,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AnthropicLike } from "../../src/llm/client.js";

let messageSeq = 0;
let toolSeq = 0;

export class FakeAnthropic implements AnthropicLike {
  readonly requests: unknown[] = []; // every create() params, in order
  private readonly scripted: BetaMessage[] = [];

  readonly beta: AnthropicLike["beta"] = {
    messages: {
      create: async (params) => {
        this.requests.push(structuredClone(params));
        const next = this.scripted.shift();
        if (!next) throw new Error("FakeAnthropic: no scripted response");
        return next;
      },
    },
  };

  // answered in order; create() on an empty queue throws
  queue(...msgs: BetaMessage[]): this {
    this.scripted.push(...msgs);
    return this;
  }
}

export function fakeMessage(
  content: BetaContentBlock[],
  opts?: { stop_reason?: string; model?: string; usage?: Partial<BetaUsage> },
): BetaMessage {
  messageSeq += 1;
  const hasToolUse = content.some((b) => b.type === "tool_use");
  const stopReason = opts?.stop_reason ?? (hasToolUse ? "tool_use" : "end_turn");
  return {
    id: `msg_fake_${messageSeq}`,
    container: null,
    content,
    context_management: null,
    diagnostics: null,
    model: opts?.model ?? "claude-sonnet-5-5",
    role: "assistant",
    stop_details: null,
    stop_reason: stopReason as BetaStopReason,
    stop_sequence: null,
    type: "message",
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      fallback_credit: null,
      inference_geo: null,
      input_tokens: 100,
      iterations: null,
      output_tokens: 50,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
      speed: null,
      ...opts?.usage,
    },
  };
}

export const block: {
  text(text: string): BetaContentBlock;
  thinking(thinking: string): BetaContentBlock;
  toolUse(name: string, input: unknown, id?: string): BetaContentBlock;
  mcpToolUse(name: string, input: unknown, id?: string): BetaContentBlock; // server_name "wizzrobe"
  mcpToolResult(toolUseId: string, text: string, isError?: boolean): BetaContentBlock;
} = {
  text(text: string): BetaContentBlock {
    const b: BetaTextBlock = { type: "text", text, citations: null };
    return b;
  },
  thinking(thinking: string): BetaContentBlock {
    const b: BetaThinkingBlock = { type: "thinking", thinking, signature: "sig_fake" };
    return b;
  },
  toolUse(name: string, input: unknown, id?: string): BetaContentBlock {
    toolSeq += 1;
    const b: BetaToolUseBlock = {
      type: "tool_use",
      id: id ?? `toolu_fake_${toolSeq}`,
      name,
      input,
    };
    return b;
  },
  mcpToolUse(name: string, input: unknown, id?: string): BetaContentBlock {
    toolSeq += 1;
    const b: BetaMCPToolUseBlock = {
      type: "mcp_tool_use",
      id: id ?? `mcptoolu_fake_${toolSeq}`,
      name,
      server_name: "wizzrobe",
      input,
    };
    return b;
  },
  mcpToolResult(toolUseId: string, text: string, isError?: boolean): BetaContentBlock {
    const b: BetaMCPToolResultBlock = {
      type: "mcp_tool_result",
      tool_use_id: toolUseId,
      is_error: isError ?? false,
      content: [{ type: "text", text, citations: null }],
    };
    return b;
  },
};
