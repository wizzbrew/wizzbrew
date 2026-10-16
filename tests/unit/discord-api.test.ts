import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { discordApi, setDiscordApiForTests } from "../../src/discord/api.js";
import { DiscordError } from "../../src/errors.js";

const APP_ID = "1234567890";
const BOT_TOKEN = "test-bot-token-do-not-leak";
const INTERACTION_TOKEN = "test-interaction-token-do-not-leak";
const BASE = "https://discord.com/api/v10";

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

interface Call {
  url: string;
  init: RequestInit;
}

function headersOf(call: Call): Record<string, string> {
  return call.init.headers as Record<string, string>;
}

describe("discord api client", () => {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

  function call(n: number): Call {
    const entry = fetchMock.mock.calls[n];
    if (!entry) throw new Error(`no fetch call at ${n}`);
    return { url: entry[0], init: entry[1] };
  }

  async function messageOf(promise: Promise<unknown>): Promise<DiscordError> {
    try {
      await promise;
    } catch (err) {
      if (err instanceof DiscordError) return err;
      throw err;
    }
    throw new Error("expected a DiscordError");
  }

  beforeAll(() => {
    vi.stubEnv("DISCORD_APPLICATION_ID", APP_ID);
    vi.stubEnv("DISCORD_BOT_TOKEN", BOT_TOKEN);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    setDiscordApiForTests(null);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("editOriginal PATCHes the original message with JSON and no auth header", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await discordApi().editOriginal(INTERACTION_TOKEN, { content: "hi" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const c = call(0);
    expect(c.url).toBe(`${BASE}/webhooks/${APP_ID}/${INTERACTION_TOKEN}/messages/@original`);
    expect(c.init.method).toBe("PATCH");
    expect(headersOf(c)["Content-Type"]).toBe("application/json");
    expect(headersOf(c).Authorization).toBeUndefined();
    expect(JSON.parse(c.init.body as string)).toEqual({ content: "hi" });
  });

  it("followup POSTs to the webhook with JSON and no auth header", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await discordApi().followup(INTERACTION_TOKEN, { content: "more", flags: 64 });

    const c = call(0);
    expect(c.url).toBe(`${BASE}/webhooks/${APP_ID}/${INTERACTION_TOKEN}`);
    expect(c.init.method).toBe("POST");
    expect(headersOf(c)["Content-Type"]).toBe("application/json");
    expect(headersOf(c).Authorization).toBeUndefined();
    expect(JSON.parse(c.init.body as string)).toEqual({ content: "more", flags: 64 });
  });

  it("postMessage replies under a message with the Bot header and no mentions", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await discordApi().postMessage(
      "555",
      { content: "hi", allowed_mentions: { parse: ["everyone"] } },
      "777",
    );

    const c = call(0);
    expect(c.url).toBe(`${BASE}/channels/555/messages`);
    expect(c.init.method).toBe("POST");
    expect(headersOf(c).Authorization).toBe(`Bot ${BOT_TOKEN}`);
    expect(JSON.parse(c.init.body as string)).toEqual({
      content: "hi",
      allowed_mentions: { parse: [] },
      message_reference: { message_id: "777", fail_if_not_exists: false },
    });
  });

  it("postMessage without a reply id sends no message_reference", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await discordApi().postMessage("555", { content: "hi" });
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      content: "hi",
      allowed_mentions: { parse: [] },
    });
  });

  it("postMessage names the missing permissions on a 403", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { message: "Missing Access", code: 50001 }));
    const err = await messageOf(discordApi().postMessage("555", { content: "hi" }));
    expect(err.status).toBe(403);
    expect(err.message).toContain("the bot needs View Channel and Send Messages there");
  });

  it("registerCommands PUTs global commands with the Bot header", async () => {
    fetchMock.mockResolvedValueOnce(json(200, []));
    await discordApi().registerCommands([{ name: "ask" }]);

    const c = call(0);
    expect(c.url).toBe(`${BASE}/applications/${APP_ID}/commands`);
    expect(c.init.method).toBe("PUT");
    expect(headersOf(c).Authorization).toBe(`Bot ${BOT_TOKEN}`);
    expect(headersOf(c)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(c.init.body as string)).toEqual([{ name: "ask" }]);
  });

  it("registerCommands PUTs guild commands when a guild id is given", async () => {
    fetchMock.mockResolvedValueOnce(json(200, []));
    await discordApi().registerCommands([{ name: "ask" }], "999");

    const c = call(0);
    expect(c.url).toBe(`${BASE}/applications/${APP_ID}/guilds/999/commands`);
    expect(c.init.method).toBe("PUT");
    expect(headersOf(c).Authorization).toBe(`Bot ${BOT_TOKEN}`);
  });

  it("names the missing scope on a 403 from registerCommands", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { message: "Missing Access", code: 50001 }));
    const err = await messageOf(discordApi().registerCommands([], "999"));

    expect(err.status).toBe(403);
    expect(err.message).toContain("applications.commands");
    expect(err.message).toContain("Missing Access");
    expect(err.message).toContain("50001");
  });

  it("names the channel permissions on a 403 from a webhook call", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { message: "Missing Permissions", code: 50013 }));
    const err = await messageOf(discordApi().followup(INTERACTION_TOKEN, { content: "x" }));

    expect(err.status).toBe(403);
    expect(err.message).toContain("View Channel and Send Messages");
    expect(err.message).toContain("50013");
  });

  it("throws a DiscordError carrying the status on a 500", async () => {
    fetchMock.mockResolvedValueOnce(json(500, { message: "Internal Server Error", code: 0 }));
    const err = await messageOf(discordApi().editOriginal(INTERACTION_TOKEN, { content: "x" }));

    expect(err).toBeInstanceOf(DiscordError);
    expect(err.status).toBe(500);
    expect(err.message).toContain("Internal Server Error");
  });

  it("still throws a DiscordError when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));
    const err = await messageOf(discordApi().editOriginal(INTERACTION_TOKEN, { content: "x" }));

    expect(err.status).toBe(502);
    expect(err.message).toContain("502");
  });

  it("retries once after a short 429 and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(429, { message: "You are being rate limited.", retry_after: 0.01 }),
      )
      .mockResolvedValueOnce(json(200, {}));
    await discordApi().followup(INTERACTION_TOKEN, { content: "x" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(call(1).url).toBe(call(0).url);
  });

  it("honors the Retry-After header when the body has no retry_after", async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, { message: "slow down" }, { "Retry-After": "0.01" }))
      .mockResolvedValueOnce(json(200, {}));
    await discordApi().followup(INTERACTION_TOKEN, { content: "x" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not wait when a 429 asks for more than 5 seconds", async () => {
    fetchMock.mockResolvedValueOnce(json(429, { message: "slow down", retry_after: 30 }));
    const err = await messageOf(discordApi().followup(INTERACTION_TOKEN, { content: "x" }));

    expect(err.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 only once", async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, { retry_after: 0.01 }))
      .mockResolvedValueOnce(json(429, { retry_after: 0.01 }));
    const err = await messageOf(discordApi().followup(INTERACTION_TOKEN, { content: "x" }));

    expect(err.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("wraps a network failure in a DiscordError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const err = await messageOf(discordApi().followup(INTERACTION_TOKEN, { content: "x" }));

    expect(err.status).toBe(0);
  });

  it("never puts either token in an error message", async () => {
    const makeResponses = (): Response[] => [
      json(403, { message: "Missing Access", code: 50001 }),
      json(404, { message: "Unknown Webhook", code: 10015 }),
      json(500, { message: "boom" }),
      json(429, { retry_after: 30 }),
      new Response("nope", { status: 400 }),
    ];
    for (const response of makeResponses()) {
      fetchMock.mockResolvedValueOnce(response);
      const err = await messageOf(discordApi().registerCommands([{ name: "ask" }], "999"));
      expect(err.message).not.toContain(BOT_TOKEN);
      expect(err.message).not.toContain(INTERACTION_TOKEN);
    }
    for (const response of makeResponses()) {
      fetchMock.mockResolvedValueOnce(response);
      const err = await messageOf(discordApi().editOriginal(INTERACTION_TOKEN, { content: "x" }));
      expect(err.message).not.toContain(BOT_TOKEN);
      expect(err.message).not.toContain(INTERACTION_TOKEN);
    }
  });

  it("setDiscordApiForTests swaps the client and null restores the real one", async () => {
    const fake = {
      editOriginal: vi.fn(() => Promise.resolve()),
      followup: vi.fn(() => Promise.resolve()),
      registerCommands: vi.fn(() => Promise.resolve()),
      postMessage: vi.fn(() => Promise.resolve()),
    };
    setDiscordApiForTests(fake);
    expect(discordApi()).toBe(fake);
    await discordApi().followup("t", { content: "x" });
    expect(fake.followup).toHaveBeenCalledWith("t", { content: "x" });
    expect(fetchMock).not.toHaveBeenCalled();

    setDiscordApiForTests(null);
    expect(discordApi()).not.toBe(fake);
  });
});
