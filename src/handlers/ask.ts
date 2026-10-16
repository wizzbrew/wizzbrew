import type { APIInteraction } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";
import type { RoutingDecision } from "../types.js";

export interface PipelineRequest {
  requestId: string;
  interaction: APIInteraction; // for loadAsker and the interaction token
  question: string; // raw text; the pipeline runs normalizeInput itself
  ephemeral: boolean;
  forced?: RoutingDecision; // shortcuts, /me and picked choices skip the router
  now: Date;
}

export async function runAskPipeline(_req: PipelineRequest): Promise<void> {
  throw new NotImplemented("ask.runAskPipeline");
}
