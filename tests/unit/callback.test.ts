import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserInputError, WizzrobeError } from "../../src/errors.js";

const m = vi.hoisted(() => ({ finishLink: vi.fn() }));
vi.mock("../../src/wizzrobe/oauth.js", () => ({ finishLink: m.finishLink }));

import { GET } from "../../api/oauth/callback.js";

const req = (qs: string) => new Request(`https://bot.example/api/oauth/callback${qs}`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("oauth callback", () => {
  it("200 with headers on success", async () => {
    m.finishLink.mockResolvedValue({ discordUserId: "1" });
    const res = await GET(req("?code=abc&state=xyz"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    const body = await res.text();
    expect(body).toContain("Linked. Go back to Discord");
    expect(body).not.toContain("abc");
    expect(m.finishLink).toHaveBeenCalledWith("abc", "xyz");
  });

  it("400 on error param", async () => {
    const res = await GET(req("?error=access_denied"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Linking was cancelled");
    expect(m.finishLink).not.toHaveBeenCalled();
  });

  it("400 on missing code", async () => {
    const res = await GET(req("?state=xyz"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("incomplete");
  });

  it("400 on UserInputError", async () => {
    m.finishLink.mockRejectedValue(new UserInputError("That link expired."));
    const res = await GET(req("?code=a&state=b"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("That link expired.");
  });

  it("502 on WizzrobeError", async () => {
    m.finishLink.mockRejectedValue(new WizzrobeError(400, "bad grant"));
    const res = await GET(req("?code=a&state=b"));
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("Wizzrobe didn&#39;t accept the link (bad grant)");
  });

  it("500 on unknown error", async () => {
    m.finishLink.mockRejectedValue(new Error("kaboom"));
    const res = await GET(req("?code=a&state=b"));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("Something went wrong");
    expect(body).not.toContain("kaboom");
  });

  it("never echoes a script state", async () => {
    m.finishLink.mockRejectedValue(new Error("x"));
    const res = await GET(req("?code=a&state=%3Cscript%3Ealert(1)%3C%2Fscript%3E"));
    expect(await res.text()).not.toContain("<script>");
  });

  it("escapes error detail", async () => {
    m.finishLink.mockRejectedValue(new WizzrobeError(400, "<b>bold</b>"));
    const body = await (await GET(req("?code=a&state=b"))).text();
    expect(body).not.toContain("<b>");
    expect(body).toContain("&lt;b&gt;");
  });
});
