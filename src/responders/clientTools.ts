import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { NotImplemented } from "../errors.js";
import type { ClientTool } from "../router/routes.js";
import type { AskContext } from "../types.js";

export function clientToolDefs(_names: ClientTool[]): BetaTool[] {
  throw new NotImplemented("clientTools.clientToolDefs");
}

export async function runClientTool(
  _name: ClientTool,
  _input: unknown,
  _ctx: AskContext,
): Promise<string> {
  throw new NotImplemented("clientTools.runClientTool");
}
