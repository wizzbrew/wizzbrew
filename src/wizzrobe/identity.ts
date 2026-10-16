import type { APIInteraction } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";
import type { Asker, LinkRecord } from "../types.js";

export async function loadAsker(_i: APIInteraction): Promise<Asker> {
  throw new NotImplemented("identity.loadAsker");
}

export async function getLink(_discordUserId: string): Promise<LinkRecord | null> {
  throw new NotImplemented("identity.getLink");
}

export async function saveLink(_discordUserId: string, _rec: LinkRecord): Promise<void> {
  throw new NotImplemented("identity.saveLink");
}

export async function deleteLink(_discordUserId: string): Promise<void> {
  throw new NotImplemented("identity.deleteLink");
}
