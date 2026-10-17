import { describe, expect, it } from "vitest";
import { block, FakeAnthropic, fakeMessage } from "../fakes/anthropic.js";
import { FakeChallonge } from "../fakes/challonge.js";
import { FakeDiscordApi } from "../fakes/discord.js";
import { combineFetch } from "../fakes/fetch.js";
import { FakeKv } from "../fakes/kv.js";
import { FakeWizzrobe } from "../fakes/wizzrobe.js";

describe("FakeKv", () => {
  it("sets and gets a value, null when missing", async () => {
    const kv = new FakeKv();
    expect(await kv.get("a")).toBeNull();
    await kv.set("a", { n: 1 });
    expect(await kv.get("a")).toEqual({ n: 1 });
  });

  it("expires a TTL key against the injected clock and removes it", async () => {
    let now = 1_000_000;
    const kv = new FakeKv(() => now);
    await kv.set("k", "v", 10);
    expect(kv.has("k")).toBe(true);
    now += 9_999;
    expect(await kv.get("k")).toBe("v");
    now += 1;
    expect(kv.has("k")).toBe(false);
    expect(await kv.get("k")).toBeNull();
    expect(kv.keys()).toEqual([]);
  });

  it("keeps a key without a TTL forever", async () => {
    let now = 0;
    const kv = new FakeKv(() => now);
    await kv.set("k", 1);
    now += 10 ** 12;
    expect(await kv.get("k")).toBe(1);
  });

  it("incrByFloat treats missing as 0, accumulates, and sets the TTL", async () => {
    let now = 0;
    const kv = new FakeKv(() => now);
    expect(await kv.incrByFloat("spend", 0.25, 60)).toBe(0.25);
    expect(await kv.incrByFloat("spend", 0.5)).toBe(0.75);
    now += 59_000;
    expect(kv.has("spend")).toBe(true);
    now += 1_000;
    expect(kv.has("spend")).toBe(false);
    expect(await kv.incrByFloat("spend", 1)).toBe(1);
  });

  it("expire sets a TTL on a present key and ignores a missing key", async () => {
    let now = 0;
    const kv = new FakeKv(() => now);
    await kv.expire("missing", 5);
    expect(kv.has("missing")).toBe(false);
    await kv.set("k", "v");
    await kv.expire("k", 5);
    now += 5_000;
    expect(kv.has("k")).toBe(false);
  });

  it("take returns and removes a value once", async () => {
    const kv = new FakeKv();
    await kv.set("k", { a: 1 });
    expect(await kv.take("k")).toEqual({ a: 1 });
    expect(await kv.take("k")).toBeNull();
    expect(kv.has("k")).toBe(false);
  });

  it("setIfAbsent sets once, honors the clock, and sets again after expiry", async () => {
    let now = 0;
    const kv = new FakeKv(() => now);
    expect(await kv.setIfAbsent("l", 1, 10)).toBe(true);
    expect(await kv.setIfAbsent("l", 2, 10)).toBe(false);
    expect(await kv.get("l")).toBe(1);
    now += 10_000;
    expect(await kv.setIfAbsent("l", 3, 10)).toBe(true);
    expect(await kv.get("l")).toBe(3);
  });

  it("del removes a key; has and keys list live keys", async () => {
    const kv = new FakeKv();
    await kv.set("a", 1);
    await kv.set("b", 2);
    expect(kv.keys().sort()).toEqual(["a", "b"]);
    await kv.del("a");
    expect(kv.has("a")).toBe(false);
    expect(kv.keys()).toEqual(["b"]);
  });

  it("returns a copy on get and stores a copy on set", async () => {
    const kv = new FakeKv();
    const original = { list: [1, 2] };
    await kv.set("k", original);
    original.list.push(3);
    const first = await kv.get<{ list: number[] }>("k");
    expect(first).toEqual({ list: [1, 2] });
    first?.list.push(99);
    expect(await kv.get("k")).toEqual({ list: [1, 2] });
  });
});

describe("FakeAnthropic", () => {
  const params = {
    max_tokens: 10,
    messages: [{ role: "user" as const, content: "hi" }],
    model: "m",
  };

  it("answers queued messages in order and records each request", async () => {
    const first = fakeMessage([block.text("one")]);
    const second = fakeMessage([block.text("two")]);
    const fake = new FakeAnthropic().queue(first).queue(second);
    expect(await fake.beta.messages.create(params)).toBe(first);
    expect(await fake.beta.messages.create({ ...params, max_tokens: 20 })).toBe(second);
    expect(fake.requests).toHaveLength(2);
    expect((fake.requests[1] as { max_tokens: number }).max_tokens).toBe(20);
  });

  it("records a copy of the params", async () => {
    const fake = new FakeAnthropic().queue(fakeMessage([block.text("x")]));
    const mutable = { ...params, messages: [{ role: "user" as const, content: "hi" }] };
    await fake.beta.messages.create(mutable);
    mutable.messages.push({ role: "user", content: "later" });
    expect((fake.requests[0] as { messages: unknown[] }).messages).toHaveLength(1);
  });

  it("throws on an empty queue, after recording the request", async () => {
    const fake = new FakeAnthropic();
    await expect(fake.beta.messages.create(params)).rejects.toThrow(
      "FakeAnthropic: no scripted response",
    );
    expect(fake.requests).toHaveLength(1);
  });
});

describe("fakeMessage and block", () => {
  it("builds a complete message with default stop_reason and usage", () => {
    const msg = fakeMessage([block.text("hello")]);
    expect(msg.type).toBe("message");
    expect(msg.role).toBe("assistant");
    expect(msg.model).toBe("claude-sonnet-5-5");
    expect(msg.id).toMatch(/^msg_fake_\d+$/);
    expect(msg.stop_reason).toBe("end_turn");
    expect(msg.stop_sequence).toBeNull();
    expect(msg.usage.input_tokens).toBe(100);
    expect(msg.usage.output_tokens).toBe(50);
    expect(msg.usage.cache_creation_input_tokens).toBe(0);
    expect(msg.usage.cache_read_input_tokens).toBe(0);
    expect(fakeMessage([block.text("again")]).id).not.toBe(msg.id);
  });

  it("defaults stop_reason to tool_use when a tool_use block is present", () => {
    expect(fakeMessage([block.text("x"), block.toolUse("t", {})]).stop_reason).toBe("tool_use");
    expect(fakeMessage([block.mcpToolUse("t", {})]).stop_reason).toBe("end_turn");
  });

  it("honors stop_reason, model and usage overrides", () => {
    const msg = fakeMessage([block.text("x")], {
      stop_reason: "max_tokens",
      model: "claude-haiku-5-5",
      usage: { input_tokens: 7, cache_read_input_tokens: 3 },
    });
    expect(msg.stop_reason).toBe("max_tokens");
    expect(msg.model).toBe("claude-haiku-5-5");
    expect(msg.usage.input_tokens).toBe(7);
    expect(msg.usage.cache_read_input_tokens).toBe(3);
    expect(msg.usage.output_tokens).toBe(50);
  });

  it("builds blocks with the SDK shapes", () => {
    expect(block.text("hi")).toEqual({ type: "text", text: "hi", citations: null });
    expect(block.thinking("hmm")).toEqual({
      type: "thinking",
      thinking: "hmm",
      signature: "sig_fake",
    });
    expect(block.toolUse("lookup", { a: 1 }, "toolu_x")).toEqual({
      type: "tool_use",
      id: "toolu_x",
      name: "lookup",
      input: { a: 1 },
    });
    expect(block.toolUse("lookup", {}).type).toBe("tool_use");
    expect(block.mcpToolUse("get_match", { id: 1 }, "mcptoolu_x")).toEqual({
      type: "mcp_tool_use",
      id: "mcptoolu_x",
      name: "get_match",
      server_name: "wizzrobe",
      input: { id: 1 },
    });
    expect(block.mcpToolResult("mcptoolu_x", "body")).toEqual({
      type: "mcp_tool_result",
      tool_use_id: "mcptoolu_x",
      is_error: false,
      content: [{ type: "text", text: "body", citations: null }],
    });
    expect(block.mcpToolResult("mcptoolu_x", "bad", true)).toMatchObject({ is_error: true });
  });
});

describe("FakeDiscordApi", () => {
  it("records every call with its token and body", async () => {
    const api = new FakeDiscordApi();
    await api.editOriginal("tok1", { content: "a" });
    await api.followup("tok2", { content: "b" });
    await api.deleteOriginal("tok3");
    await api.registerCommands([{ name: "ask" }], "guild");
    expect(api.calls).toEqual([
      { method: "editOriginal", token: "tok1", body: { content: "a" } },
      { method: "followup", token: "tok2", body: { content: "b" } },
      { method: "deleteOriginal", token: "tok3", body: null },
      { method: "registerCommands", token: null, body: [{ name: "ask" }] },
    ]);
  });

  it("failNext makes exactly the next call reject, and still records it", async () => {
    const api = new FakeDiscordApi();
    const boom = new Error("boom");
    api.failNext(boom);
    await expect(api.editOriginal("t", {})).rejects.toBe(boom);
    await expect(api.editOriginal("t", {})).resolves.toBeUndefined();
    expect(api.calls).toHaveLength(2);
  });
});

describe("FakeWizzrobe tools", () => {
  it("answers get_match from the fixture without _note", async () => {
    const wz = new FakeWizzrobe();
    const res = await wz.rawToolCall("tok", "get_match", { match_id: 1 });
    expect(res.isError).toBe(false);
    const body = JSON.parse(res.text) as Record<string, unknown>;
    expect(body.id).toBe(1);
    expect("_note" in body).toBe(false);
  });

  it("records calls with the token and args", async () => {
    const wz = new FakeWizzrobe();
    await wz.rawToolCall("user-token", "get_match", { match_id: 1 });
    expect(wz.calls).toEqual([{ tool: "get_match", token: "user-token", args: { match_id: 1 } }]);
  });

  it("answer() overrides the fixture", async () => {
    const wz = new FakeWizzrobe();
    wz.answer("get_match", { id: 77 });
    expect(await wz.rawToolCall("t", "get_match", {})).toEqual({
      isError: false,
      text: '{"id":77}',
    });
  });

  it("failTool returns an error text of code: message", async () => {
    const wz = new FakeWizzrobe();
    wz.failTool("get_match", "forbidden", "Not allowed");
    expect(await wz.rawToolCall("t", "get_match", {})).toEqual({
      isError: true,
      text: "forbidden: Not allowed",
    });
  });

  it("answers not_found for bracket tools while featuresOff, and uses answer() once on", async () => {
    const wz = new FakeWizzrobe();
    expect(wz.featuresOff).toBe(true);
    const off = await wz.rawToolCall("t", "list_brackets", {});
    expect(off).toEqual({
      isError: true,
      text: "not_found: This feature is not enabled for this community.",
    });
    wz.featuresOff = false;
    wz.answer("list_brackets", []);
    expect(await wz.rawToolCall("t", "list_brackets", {})).toEqual({ isError: false, text: "[]" });
  });

  it("returns ok for a write tool with no fixture", async () => {
    const wz = new FakeWizzrobe();
    expect(await wz.rawToolCall("t", "acknowledge_match", { match_id: 1 })).toEqual({
      isError: false,
      text: '{"ok":true}',
    });
  });

  it("answers not_found for an unknown tool", async () => {
    const wz = new FakeWizzrobe();
    expect(await wz.rawToolCall("t", "no_such_tool", {})).toEqual({
      isError: true,
      text: "not_found: no fixture for no_such_tool",
    });
  });
});

describe("FakeWizzrobe REST", () => {
  const origin = "https://onsite.speedgaming.org";
  const authed = (body?: unknown): RequestInit => ({
    method: "POST",
    headers: { Authorization: "Bearer rest-token", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  it("creates a reschedule request", async () => {
    const wz = new FakeWizzrobe();
    const res = await wz.fetch(
      `${origin}/api/matches/1/reschedule-requests`,
      authed({ reason: "x" }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.kind).toBe("reschedule");
    expect("_note" in body).toBe(false);
    expect(wz.calls).toEqual([
      {
        tool: "rest:POST /api/matches/1/reschedule-requests",
        token: "rest-token",
        args: { reason: "x" },
      },
    ]);
  });

  it("books a bracket game", async () => {
    const wz = new FakeWizzrobe();
    const res = await wz.fetch(`${origin}/api/brackets/matches/301/games`, authed());
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(301);
    expect("_note" in body).toBe(false);
    expect(wz.calls[0]).toEqual({
      tool: "rest:POST /api/brackets/matches/301/games",
      token: "rest-token",
      args: {},
    });
  });

  it("lists my open bracket matches as a bare array", async () => {
    const wz = new FakeWizzrobe();
    const res = await wz.fetch(`${origin}/api/brackets/my-open-matches`, {
      headers: { Authorization: "Bearer rest-token" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    expect((body as { id: number }[])[0]?.id).toBe(301);
    expect(wz.calls[0]?.tool).toBe("rest:GET /api/brackets/my-open-matches");
  });

  it("answers 404 for any other route", async () => {
    const wz = new FakeWizzrobe();
    const res = await wz.fetch(`${origin}/api/nothing`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Not Found" });
  });

  it("failRest answers the status, detail and Retry-After by path prefix", async () => {
    const wz = new FakeWizzrobe();
    wz.failRest("/api/brackets", 429, "Too many requests", 7);
    const res = await wz.fetch(`${origin}/api/brackets/my-open-matches`);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(await res.json()).toEqual({ detail: "Too many requests" });

    wz.failRest("/api/matches", 403, "Forbidden");
    const plain = await wz.fetch(`${origin}/api/matches/1/reschedule-requests`, authed());
    expect(plain.status).toBe(403);
    expect(plain.headers.get("retry-after")).toBeNull();
  });
});

describe("FakeChallonge", () => {
  const base = "https://api.challonge.com/v2.1/tournaments/sgl26alttpr";

  it("serves tournament, participants and matches", async () => {
    const ch = new FakeChallonge();
    const tournament = (await (await ch.fetch(`${base}.json`)).json()) as {
      data: { type: string };
    };
    expect(tournament.data.type).toBe("tournament");
    const participants = (await (await ch.fetch(`${base}/participants.json?page=1`)).json()) as {
      data: { type: string }[];
    };
    expect(participants.data[0]?.type).toBe("participant");
    const matches = (await (
      await ch.fetch(`${base}/matches.json?page=1&per_page=100`)
    ).json()) as Record<string, unknown>;
    expect((matches.data as { type: string }[])[0]?.type).toBe("match");
    expect("_note" in matches).toBe(false);
    expect(ch.requests).toEqual([
      `${base}.json`,
      `${base}/participants.json?page=1`,
      `${base}/matches.json?page=1&per_page=100`,
    ]);
  });

  it("answers an empty page for page 2", async () => {
    const ch = new FakeChallonge();
    const res = await ch.fetch(`${base}/matches.json?page=2`);
    expect(await res.json()).toEqual({ data: [] });
  });

  it("answers 404 for an unknown path", async () => {
    const ch = new FakeChallonge();
    expect((await ch.fetch("https://api.challonge.com/v2.1/other.json")).status).toBe(404);
  });

  it("fail(500) makes every later request fail with the Challonge error shape", async () => {
    const ch = new FakeChallonge();
    ch.fail(500);
    const res = await ch.fetch(`${base}/matches.json`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ errors: [{ status: "500", detail: "fake failure" }] });
    expect((await ch.fetch(`${base}.json`)).status).toBe(500);
    expect(ch.requests).toHaveLength(2);
  });
});

describe("combineFetch", () => {
  const stub =
    (label: string): typeof fetch =>
    async () =>
      new Response(label);

  it("routes by URL prefix, first match wins", async () => {
    const f = combineFetch(
      { prefix: "https://a.test/api", fetch: stub("a-api") },
      { prefix: "https://a.test", fetch: stub("a") },
      { prefix: "https://b.test", fetch: stub("b") },
    );
    expect(await (await f("https://a.test/api/x")).text()).toBe("a-api");
    expect(await (await f("https://a.test/other")).text()).toBe("a");
    expect(await (await f(new URL("https://b.test/y"))).text()).toBe("b");
  });

  it("rejects an unknown URL", async () => {
    const f = combineFetch({ prefix: "https://a.test", fetch: stub("a") });
    await expect(f("https://c.test/z")).rejects.toThrow("no fake for https://c.test/z");
  });

  it("composes the Wizzrobe and Challonge fakes", async () => {
    const wz = new FakeWizzrobe();
    const ch = new FakeChallonge();
    const f = combineFetch(
      { prefix: "https://onsite.speedgaming.org", fetch: wz.fetch },
      { prefix: "https://api.challonge.com", fetch: ch.fetch },
    );
    expect((await f("https://onsite.speedgaming.org/api/brackets/my-open-matches")).status).toBe(
      200,
    );
    expect((await f("https://api.challonge.com/v2.1/tournaments/x.json")).status).toBe(200);
  });
});
