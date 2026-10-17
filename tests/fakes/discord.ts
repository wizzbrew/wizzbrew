import type { DiscordApi } from "../../src/discord/api.js";

type Method = "editOriginal" | "deleteOriginal" | "followup" | "registerCommands" | "postMessage";

export class FakeDiscordApi implements DiscordApi {
  readonly calls: {
    method: Method;
    token: string | null;
    body: unknown;
  }[] = [];

  private pendingFailure: Error | null = null;

  // the next call throws err
  failNext(err: Error): void {
    this.pendingFailure = err;
  }

  // Records the call, then rejects once if failNext was armed.
  private record(method: Method, token: string | null, body: unknown): void {
    this.calls.push({ method, token, body });
    const failure = this.pendingFailure;
    if (failure) {
      this.pendingFailure = null;
      throw failure;
    }
  }

  async editOriginal(token: string, body: unknown): Promise<void> {
    this.record("editOriginal", token, body);
  }

  async deleteOriginal(token: string): Promise<void> {
    this.record("deleteOriginal", token, null);
  }

  async followup(token: string, body: unknown): Promise<void> {
    this.record("followup", token, body);
  }

  async postMessage(channelId: string, body: unknown, replyToMessageId?: string): Promise<void> {
    this.record("postMessage", null, { channelId, replyToMessageId, body });
  }

  async registerCommands(commands: unknown[], _guildId?: string): Promise<void> {
    this.record("registerCommands", null, commands);
  }
}
