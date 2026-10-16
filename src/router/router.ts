import { NotImplemented } from "../errors.js";
import type { AskContext, RoutingDecision } from "../types.js";

export async function routeQuestion(_ctx: AskContext): Promise<RoutingDecision> {
  throw new NotImplemented("router.routeQuestion");
}
