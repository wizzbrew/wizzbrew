import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asker, LinkRecord } from "../../src/types.js";

const m = vi.hoisted(() => ({
  getLink: vi.fn(),
  deleteLink: vi.fn(),
  startLink: vi.fn(),
  revoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock("../../src/wizzrobe/identity.js", () => ({ getLink: m.getLink, deleteLink: m.deleteLink }));
vi.mock("../../src/wizzrobe/oauth.js", () => ({ startLink: m.startLink, revoke: m.revoke }));
vi.mock("../../src/store/crypto.js", () => ({ open: m.open }));

import { accountAnswer } from "../../src/handlers/account.js";

const asker: Asker = {
  discordUserId: "42",
  discordName: "tester",
  guildId: null,
  channelId: "c",
  linked: null,
};
const rec = { sealedRefreshToken: "sealed", username: "zelda" } as LinkRecord;
const now = new Date("2026-10-15T12:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  m.open.mockResolvedValue("plain-refresh");
  m.revoke.mockResolvedValue(undefined);
  m.deleteLink.mockResolvedValue(undefined);
});

describe("accountAnswer", () => {
  it("link when unlinked returns the private link", async () => {
    m.getLink.mockResolvedValue(null);
    m.startLink.mockResolvedValue({ url: "https://w.example/auth" });
    const a = await accountAnswer("link", asker, now);
    expect(a.ephemeral).toBe(true);
    expect(a.text).toContain("[Link Wizzrobe](<https://w.example/auth>)");
    expect(a.text).toContain("expires in 10 minutes");
    expect(m.startLink).toHaveBeenCalledWith("42");
  });

  it("link when linked asks to unlink first", async () => {
    m.getLink.mockResolvedValue(rec);
    const a = await accountAnswer("link", asker, now);
    expect(a.ephemeral).toBe(true);
    expect(a.text).toContain("linked to Wizzrobe as zelda");
    expect(m.startLink).not.toHaveBeenCalled();
  });

  it("unlink revokes then deletes", async () => {
    m.getLink.mockResolvedValue(rec);
    const a = await accountAnswer("unlink", asker, now);
    expect(a.ephemeral).toBe(true);
    expect(a.text).toContain("Unlinked");
    expect(m.revoke).toHaveBeenCalledWith("plain-refresh");
    expect(m.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      m.deleteLink.mock.invocationCallOrder[0] ?? 0,
    );
    expect(m.deleteLink).toHaveBeenCalledWith("42");
  });

  it("unlink still deletes when revoke fails", async () => {
    m.getLink.mockResolvedValue(rec);
    m.revoke.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    const a = await accountAnswer("unlink", asker, now);
    expect(a.text).toContain("Unlinked");
    expect(m.deleteLink).toHaveBeenCalledWith("42");
  });

  it("unlink when unlinked", async () => {
    m.getLink.mockResolvedValue(null);
    const a = await accountAnswer("unlink", asker, now);
    expect(a).toEqual({ text: "You're not linked.", ephemeral: true });
    expect(m.revoke).not.toHaveBeenCalled();
    expect(m.deleteLink).not.toHaveBeenCalled();
  });

  it("startLink errors propagate", async () => {
    m.getLink.mockResolvedValue(null);
    m.startLink.mockRejectedValue(new Error("no config"));
    await expect(accountAnswer("link", asker, now)).rejects.toThrow("no config");
  });
});
