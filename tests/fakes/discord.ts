import type { DiscordApi } from "../../src/discord/api.js";
import { NotImplemented } from "../../src/errors.js";

export class FakeDiscordApi implements DiscordApi {
  readonly calls: {
    method: "editOriginal" | "followup" | "registerCommands";
    token: string | null;
    body: unknown;
  }[] = [];

  // the next call throws err
  failNext(_err: Error): void {
    throw new NotImplemented("FakeDiscordApi.failNext");
  }

  async editOriginal(_token: string, _body: unknown): Promise<void> {
    throw new NotImplemented("FakeDiscordApi.editOriginal");
  }

  async followup(_token: string, _body: unknown): Promise<void> {
    throw new NotImplemented("FakeDiscordApi.followup");
  }

  async registerCommands(_commands: unknown[], _guildId?: string): Promise<void> {
    throw new NotImplemented("FakeDiscordApi.registerCommands");
  }
}
