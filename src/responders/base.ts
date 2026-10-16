import { NotImplemented } from "../errors.js";
import type { Answer, AskContext, Route, RoutingDecision } from "../types.js";

export async function runResponder(
  _route: Route,
  _decision: RoutingDecision,
  _ctx: AskContext,
): Promise<Answer> {
  throw new NotImplemented("base.runResponder");
}
