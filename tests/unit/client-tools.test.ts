import { beforeEach, describe, expect, it, vi } from "vitest";
import { bracketFor } from "../../src/challonge/challonge.js";
import type * as ParticipantsModule from "../../src/event/participants.js";
import { eventParticipants } from "../../src/event/participants.js";
import { clientToolDefs, runClientTool } from "../../src/responders/clientTools.js";
import type { AskContext } from "../../src/types.js";
import { matchesForAsker } from "../../src/wizzrobe/mine.js";

vi.mock("../../src/wizzrobe/mine.js", () => ({ matchesForAsker: vi.fn() }));
vi.mock("../../src/challonge/challonge.js", () => ({ bracketFor: vi.fn() }));
vi.mock("../../src/event/participants.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ParticipantsModule>()),
  eventParticipants: vi.fn(),
}));

const mineMock = vi.mocked(matchesForAsker);
const bracketMock = vi.mocked(bracketFor);
const participantsMock = vi.mocked(eventParticipants);

const ctx: AskContext = {
  requestId: "r",
  asker: { discordUserId: "1", discordName: "me", guildId: null, channelId: "2", linked: null },
  question: "q",
  now: new Date("2026-10-15T12:00:00Z"),
  ephemeral: true,
  history: [],
};

beforeEach(() => {
  mineMock.mockReset();
  bracketMock.mockReset();
  participantsMock.mockReset();
});

describe("clientToolDefs", () => {
  it("returns strict schemas, bounds live in the description and zod", () => {
    const defs = clientToolDefs(["matches_for_me", "challonge_bracket"]);
    expect(defs).toHaveLength(2);
    for (const d of defs) {
      expect(d.strict).toBe(true);
      expect(d.input_schema.additionalProperties).toBe(false);
    }
    expect(defs[0]?.input_schema.properties).toEqual({
      days_ahead: {
        type: "integer",
        description: "How many days ahead to look, a whole number from 1 to 14",
      },
    });
    expect(defs[0]?.input_schema.required).toEqual(["days_ahead"]);
    expect(defs[1]?.input_schema.required).toEqual(["tournament_id"]);
  });
});

describe("runClientTool", () => {
  it.each([{ days_ahead: 0 }, { days_ahead: 15 }, { days_ahead: 2, user_id: 9 }, {}])(
    "rejects %j",
    async (input) => {
      expect(await runClientTool("matches_for_me", input, ctx)).toBe('{"error":"invalid input"}');
      expect(mineMock).not.toHaveBeenCalled();
    },
  );

  it("passes ctx.asker and the window, serializes ISO", async () => {
    mineMock.mockResolvedValue({
      matches: [
        {
          matchId: 1,
          tournament: "T",
          scheduledAt: new Date("2026-10-16T17:00:00Z"),
          status: "scheduled",
          stage: null,
          streamUrl: null,
          opponents: ["B"],
        },
      ],
      partial: false,
    });
    const out = JSON.parse(await runClientTool("matches_for_me", { days_ahead: 2 }, ctx));
    expect(mineMock).toHaveBeenCalledWith(ctx.asker, {
      start: ctx.now,
      end: new Date("2026-10-17T12:00:00Z"),
    });
    expect(out.matches[0].scheduled_at).toBe("2026-10-16T17:00:00.000Z");
    expect(out.matches[0].scheduled_at_epoch).toBe(Date.parse("2026-10-16T17:00:00Z") / 1000);
    expect(out.partial).toBe(false);
  });

  it("maps id_unreliable to needs_link", async () => {
    mineMock.mockResolvedValue("id_unreliable");
    expect(await runClientTool("matches_for_me", { days_ahead: 3 }, ctx)).toBe(
      '{"needs_link":true}',
    );
  });

  it("challonge_bracket validates and delegates", async () => {
    bracketMock.mockResolvedValue({ tournament: "T", fetchedAt: null } as never);
    expect(await runClientTool("challonge_bracket", { tournament_id: "x" }, ctx)).toBe(
      '{"error":"invalid input"}',
    );
    expect(await runClientTool("challonge_bracket", { tournament_id: 9 }, ctx)).toBe(
      '{"tournament":"T","fetchedAt":null}',
    );
    expect(bracketMock).toHaveBeenCalledWith(9);
  });

  it("adds an epoch sibling to the bracket snapshot time", async () => {
    bracketMock.mockResolvedValue({
      tournament: "T",
      fetchedAt: "2026-10-15T12:00:00.000Z",
      degraded: true,
    } as never);
    const out = JSON.parse(await runClientTool("challonge_bracket", { tournament_id: 9 }, ctx));
    expect(out.fetchedAt_epoch).toBe(Date.parse("2026-10-15T12:00:00Z") / 1000);
    expect(out.degraded).toBe(true);
  });

  describe("event_participants", () => {
    const list = {
      names: [
        { displayName: "PixelFox", addedAt: "2026-09-02T03:30:00.000Z" },
        { displayName: "Nimbus", addedAt: "2026-09-05T20:00:00.000Z" },
        { displayName: "Pixel Fox Two", addedAt: "not a time" },
      ],
      count: 640,
      fetchedAt: 1,
    };
    const NOTE = "This is the SGL26 attendee list on Matcherino.";

    it("is a strict one-field schema with the bound in the description", () => {
      const [def] = clientToolDefs(["event_participants"]);
      expect(def?.strict).toBe(true);
      expect(def?.input_schema.required).toEqual(["name"]);
      expect(def?.input_schema.additionalProperties).toBe(false);
      expect(Object.keys(def?.input_schema.properties ?? {})).toEqual(["name"]);
      expect(def?.description).toContain("SGL26 attendee list on Matcherino");
      expect(def?.description).toContain("display name");
      expect(def?.description).not.toContain("ticket");
    });

    it.each([
      {},
      { name: "" },
      { name: "   " },
      { name: 3 },
      { name: "a".repeat(101) },
      { name: "a", id: 1 },
    ])("rejects %j", async (input) => {
      expect(await runClientTool("event_participants", input, ctx)).toBe(
        '{"error":"invalid input"}',
      );
      expect(participantsMock).not.toHaveBeenCalled();
    });

    it("returns matches with the join date on the community clock, the total and a note", async () => {
      participantsMock.mockResolvedValue(list);
      const raw = await runClientTool("event_participants", { name: " pixelfox " }, ctx);
      expect(JSON.parse(raw)).toEqual({
        // 03:30 UTC on the 2nd is still the evening of the 1st in New York.
        matches: [{ displayName: "PixelFox", joined: "2026-09-01" }],
        total: 640,
        note: NOTE,
      });
      expect(raw).not.toContain("ticket");
    });

    it("gives a null join date when Matcherino's time is unreadable", async () => {
      participantsMock.mockResolvedValue(list);
      const raw = await runClientTool("event_participants", { name: "pixel fox two" }, ctx);
      expect(JSON.parse(raw).matches).toEqual([{ displayName: "Pixel Fox Two", joined: null }]);
    });

    it("returns no matches but the total when the name is not on the list", async () => {
      participantsMock.mockResolvedValue(list);
      const raw = await runClientTool("event_participants", { name: "zorbo" }, ctx);
      expect(JSON.parse(raw)).toEqual({ matches: [], total: 640, note: NOTE });
    });

    it("reports the list unavailable when the feature is off or there is no data", async () => {
      participantsMock.mockResolvedValue(null);
      expect(await runClientTool("event_participants", { name: "nimbus" }, ctx)).toBe(
        '{"matches":[],"total":0,"note":"participants list unavailable"}',
      );
    });

    it("carries nothing but the display name and join date for each match", async () => {
      const extra = { displayName: "Nimbus", addedAt: "2026-09-05T20:00:00.000Z", authId: "99" };
      participantsMock.mockResolvedValue({ ...list, names: [extra] });
      const raw = await runClientTool("event_participants", { name: "nimbus" }, ctx);
      expect(Object.keys(JSON.parse(raw).matches[0])).toEqual(["displayName", "joined"]);
      expect(raw).not.toContain("authId");
    });
  });
});
