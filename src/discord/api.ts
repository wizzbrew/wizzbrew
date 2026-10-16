import { NotImplemented } from "../errors.js";

export interface DiscordApi {
  editOriginal(token: string, body: unknown): Promise<void>;
  followup(token: string, body: unknown): Promise<void>;
  registerCommands(commands: unknown[], guildId?: string): Promise<void>;
}

export function discordApi(): DiscordApi {
  throw new NotImplemented("api.discordApi");
}

export function setDiscordApiForTests(_d: DiscordApi | null): void {
  throw new NotImplemented("api.setDiscordApiForTests");
}
