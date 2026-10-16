import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserInputError } from "../../src/errors.js";

const m = vi.hoisted(() => ({ verifyDiscord: vi.fn() }));
vi.mock("../../src/wizzrobe/oauth.js", () => ({ verifyDiscord: m.verifyDiscord }));

import { GET } from "../../api/oauth/discord.js";

const req = (qs: string) => new Request(`https://bot.example/api/oauth/discord${qs}`);
const TARGET = "https://idp.example/authorize?state=xyz";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("discord oauth callback", () => {
  it("302 to the Wizzrobe authorize URL on success", async () => {
    m.verifyDiscord.mockResolvedValue({ redirectTo: TARGET });
    const res = await GET(req("?code=abc&state=xyz"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(TARGET);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(m.verifyDiscord).toHaveBeenCalledWith("abc", "xyz");
  });

  it("400 on error param", async () => {
    const res = await GET(req("?error=access_denied"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Linking was cancelled");
    expect(m.verifyDiscord).not.toHaveBeenCalled();
  });

  it("400 on missing code", async () => {
    const res = await GET(req("?state=xyz"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("incomplete");
  });

  it("400 on UserInputError, escaped", async () => {
    m.verifyDiscord.mockRejectedValue(new UserInputError("<b>Wrong account</b>"));
    const res = await GET(req("?code=a&state=b"));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).not.toContain("<b>");
    expect(body).toContain("&lt;b&gt;Wrong account");
  });

  it("500 on unknown error without detail", async () => {
    m.verifyDiscord.mockRejectedValue(new Error("kaboom"));
    const res = await GET(req("?code=a&state=b"));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("Something went wrong");
    expect(body).not.toContain("kaboom");
  });
});
