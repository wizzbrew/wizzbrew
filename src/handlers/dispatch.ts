import type { APIInteraction } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";

export async function handleInteraction(
  _i: APIInteraction,
  _waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  throw new NotImplemented("dispatch.handleInteraction");
}
