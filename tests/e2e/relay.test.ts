import "./harness.js"; // first: it installs the @vercel/functions mock before api/message loads
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../api/message.js";
import { MODELS } from "../../src/llm/models.js";
import { keys } from "../../src/store/keys.js";
import type { RelayMessage } from "../../src/types.js";
import {
  buttonId,
  buttons,
  linkUser,
  type Payload,
  post,
  press,
  proposeReply,
  routerReply,
  sent,
  settle,
  setupWorld,
  teardownWorld,
  textReply,
  thinkingMcpReply,
  USER_A,
  USER_B,
  type World,
} from "./harness.js";

const SECRET = "test-relay-value-not-real-".padEnd(40, "x");
const CHANNEL = "900000000000000002";
const SIGNUP_ARGS = { match_id: 1, role: "commentator" };

let world: World;

beforeEach(async () => {
  world = await setupWorld();
});

afterEach(() => {
  teardownWorld();
});

interface Request {
  model: string;
  system?: { text: string }[];
  messages: { role: string; content: unknown }[];
}

function request(n: number): Request {
  return world.anthropic.requests[n] as Request;
}

function relayMessage(
  userId: string,
  messageId: string,
  content: string,
  over: Partial<RelayMessage> = {},
): RelayMessage {
  return {
    messageId,
    channelId: CHANNEL,
    guildId: "900000000000000001",
    isDm: false,
    author: { id: userId, username: `user${userId.slice(-2)}`, globalName: null, nick: null },
    content,
    chain: [],
    ...over,
  };
}

function sign(timestamp: string, raw: string): string {
  return createHmac("sha256", SECRET).update(`${timestamp}.${raw}`).digest("hex");
}

async function relay(
  m: RelayMessage,
  opts: { signature?: string; timestamp?: string } = {},
): Promise<Response> {
  const raw = JSON.stringify(m);
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  return POST(
    new Request("https://bot.test/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Timestamp": timestamp,
        "X-Relay-Signature": opts.signature ?? sign(timestamp, raw),
      },
      body: raw,
    }),
  );
}

interface PostedMessage {
  channelId: string;
  replyToMessageId?: string;
  body: Payload;
}

function posted(): PostedMessage[] {
  return world.discord.calls
    .filter((c) => c.method === "postMessage")
    .map((c) => c.body as PostedMessage);
}

describe("relay messages end to end", () => {
  it("1. a mention is accepted and answered as a reply", async () => {
    world.anthropic.queue(
      routerReply("schedule"),
      thinkingMcpReply("Two matches are on Fire tonight."),
    );
    const res = await relay(relayMessage(USER_B, "m1", "what's on Fire tonight"));
    expect(res.status).toBe(202);
    await settle();

    const out = posted();
    expect(out).toHaveLength(1);
    expect(out[0]?.channelId).toBe(CHANNEL);
    expect(out[0]?.replyToMessageId).toBe("m1");
    expect(out[0]?.body.content).toBe("Two matches are on Fire tonight.");
    expect(out[0]?.body.allowed_mentions).toEqual({ parse: [] });
  });

  it("2. a reply chain reaches the router and the responder", async () => {
    world.anthropic.queue(routerReply("schedule"), textReply("Tomorrow has one match."));
    const m = relayMessage(USER_B, "m2", "and tomorrow?", {
      chain: [
        { authorId: "333333333333333333", authorName: "Sam", isBot: false, content: "who plays?" },
        { authorId: "bot", authorName: "Wizzbrew", isBot: true, content: "Two matches on Fire." },
      ],
    });
    const res = await relay(m);
    expect(res.status).toBe(202);
    await settle();

    expect(world.anthropic.requests).toHaveLength(2);
    for (const n of [0, 1]) {
      const text = JSON.stringify(request(n).messages);
      expect(text).toContain("Earlier in this conversation:");
      expect(text).toContain("Sam: who plays?");
      expect(text).toContain("Two matches on Fire.");
      expect(text).toContain("and tomorrow?");
    }
    expect(posted()[0]?.body.content).toBe("Tomorrow has one match.");
  });

  it("3. a link request is a private stub and only the asker can open it", async () => {
    world.anthropic.queue(routerReply("account", { accountAction: "link" }));
    const res = await relay(relayMessage(USER_B, "m3", "connect me to SGL"));
    expect(res.status).toBe(202);
    await settle();

    const out = posted();
    expect(out).toHaveLength(1);
    expect(out[0]?.replyToMessageId).toBe("m3");
    expect(out[0]?.body.content).toBe("This one is just for you.");
    expect(buttons(out[0]?.body as Payload).map((b) => b.label)).toEqual(["Show me privately"]);
    const id = buttonId(out[0]?.body as Payload, "Show me privately");

    const other = await post(press(USER_A, "tok-other", id));
    await other.done;
    const refused = JSON.stringify(world.discord.calls.filter((c) => c.token === "tok-other"));
    expect(refused).toContain("just for the person who asked");
    expect(refused).not.toContain("oauth/authorize");

    const owner = await post(press(USER_B, "tok-owner", id));
    await owner.done;
    const edits = sent(world, "editOriginal", "tok-owner");
    expect(edits).toHaveLength(1);
    expect(edits[0]?.content).toMatch(
      /https:\/\/discord\.com\/oauth2\/authorize\?[^ ]*scope=identify[^ ]*state=[A-Za-z0-9_-]+/,
    );
  });

  it("4. a linked user's shifts come back as a stub, then privately on press", async () => {
    await linkUser(world, USER_A);
    world.anthropic.queue(routerReply("my_stuff"), textReply("You have one shift on Friday."));
    const res = await relay(relayMessage(USER_A, "m4", "what are my shifts"));
    expect(res.status).toBe(202);
    await settle();

    const out = posted();
    expect(out).toHaveLength(1);
    expect(out[0]?.body.content).toBe("This one is just for you.");
    expect(JSON.stringify(out)).not.toContain("one shift");

    const id = buttonId(out[0]?.body as Payload, "Show me privately");
    const shown = await post(press(USER_A, "tok-shifts", id));
    await shown.done;
    expect(sent(world, "editOriginal", "tok-shifts")[0]?.content).toBe(
      "You have one shift on Friday.",
    );
  });

  it("5. a signup proposal is held privately and Confirm writes with the user token", async () => {
    await linkUser(world, USER_A);
    world.anthropic.queue(
      routerReply("crew", { matchId: 1 }),
      proposeReply("signup_as_crew", SIGNUP_ARGS, "Sign up as commentator for match 1"),
    );
    const res = await relay(relayMessage(USER_A, "m5", "sign me up to track match 1"));
    expect(res.status).toBe(202);
    await settle();

    const out = posted();
    expect(out).toHaveLength(1);
    expect(out[0]?.body.content).toBe("This one is just for you.");
    const signups = () => world.wizzrobe.calls.filter((c) => c.tool === "signup_as_crew");
    expect(signups()).toHaveLength(0);

    const shown = await post(
      press(USER_A, "tok-show", buttonId(out[0]?.body as Payload, "Show me privately")),
    );
    await shown.done;
    const card = sent(world, "editOriginal", "tok-show")[0] as Payload;
    expect(card.content).toBe(
      "Sign you up as commentator for match 1.\nNote: Sign up as commentator for match 1",
    );
    expect(buttons(card).map((b) => b.label)).toContain("Confirm");

    const confirmed = await post(press(USER_A, "tok-confirm", buttonId(card, "Confirm")));
    await confirmed.done;
    expect(signups()).toEqual([
      {
        tool: "signup_as_crew",
        token: "user-token",
        args: { match_id: 1, role: "commentator", tenant: "sgl26" },
      },
    ]);
  });

  it("6. a bad signature or an old timestamp is a 401 and posts nothing", async () => {
    const m = relayMessage(USER_B, "m6", "what's on today");
    const bad = await relay(m, { signature: "0".repeat(64) });
    expect(bad.status).toBe(401);

    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const stale = await relay(m, { timestamp: old });
    expect(stale.status).toBe(401);

    await settle();
    expect(world.discord.calls).toHaveLength(0);
    expect(world.anthropic.requests).toHaveLength(0);
  });

  it("7. paused returns 200 and posts nothing", async () => {
    await world.kv.set(keys.kill(), "1");
    const res = await relay(relayMessage(USER_B, "m7", "what's on today"));
    expect(res.status).toBe(200);
    await settle();
    const out = posted();
    expect(out).toHaveLength(1);
    expect(out[0]?.replyToMessageId).toBe("m7");
    expect(out[0]?.body.content).toBe("Wizzbrew is paused right now.");
    expect(world.discord.calls).toHaveLength(1);
    expect(world.anthropic.requests).toHaveLength(0);
  });

  it("8. a second message while the first runs is told to wait", async () => {
    world.anthropic.queue(routerReply("schedule"), textReply("Two matches are on Fire today."));
    const release = world.anthropic.holdNext();
    const first = await relay(relayMessage(USER_B, "m8a", "what's on today"));
    expect(first.status).toBe(202);
    await vi.waitFor(() => expect(world.kv.has(keys.lock(USER_B))).toBe(true));

    const second = await relay(relayMessage(USER_B, "m8b", "and on Water?"));
    expect(second.status).toBe(202);
    await vi.waitFor(() => expect(posted()).toHaveLength(1));
    expect(posted()[0]?.replyToMessageId).toBe("m8b");
    expect(posted()[0]?.body.content).toBe(
      "Still working on your last one. Ask again in a moment.",
    );

    release();
    await settle();
    const replies = posted().filter((p) => p.replyToMessageId === "m8a");
    expect(replies[0]?.body.content).toBe("Two matches are on Fire today.");
  });

  it("9. casual thanks goes to chat: chat model, event block, no capability list", async () => {
    world.anthropic.queue(routerReply("chat"), textReply("Anytime."));
    const res = await relay(relayMessage(USER_B, "m9", "thanks wizzbrew!"));
    expect(res.status).toBe(202);
    await settle();

    expect(world.anthropic.requests).toHaveLength(2);
    expect(request(0).model).toBe(MODELS.router);
    expect(request(1).model).toBe(MODELS.chat);
    const system = request(1).system ?? [];
    const all = system.map((s) => s.text).join("\n");
    expect(system).toHaveLength(4);
    expect(system[2]?.text).toContain("Tournaments:");
    expect(system[3]?.text).toContain("Current time:");
    expect(system[3]?.text).not.toContain("Tournaments:");
    expect(all).toContain("Never describe yourself or list what you can do");
    const withoutProhibition = all.replace(
      /Never (answer casual talk|describe yourself)[^.]*\./g,
      "",
    );
    expect(withoutProhibition).not.toMatch(/capabilit|what (you|wizzbrew) can do/i);
    expect(posted()).toHaveLength(1);
    expect(posted()[0]?.replyToMessageId).toBe("m9");
    expect(posted()[0]?.body.content).toBe("Anytime.");
  });
});
