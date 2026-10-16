import { NotImplemented } from "../errors.js";
import type { Asker, ConversationTurn, ReplyTarget, RoutingDecision } from "../types.js";

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

export async function runAskPipeline(_req: PipelineRequest): Promise<void> {
  throw new NotImplemented("ask.runAskPipeline");
}
