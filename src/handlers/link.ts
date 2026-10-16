import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";

export async function runLinkCommand(
  _name: "link" | "unlink" | "me",
  _i: APIChatInputApplicationCommandInteraction,
  _requestId: string,
  _now: Date,
): Promise<void> {
  throw new NotImplemented("link.runLinkCommand");
}
