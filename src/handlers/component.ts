import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";

export async function runComponent(
  _i: APIMessageComponentInteraction,
  _requestId: string,
  _now: Date,
): Promise<void> {
  throw new NotImplemented("component.runComponent");
}
