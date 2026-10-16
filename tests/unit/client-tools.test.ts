import { beforeEach, describe, expect, it, vi } from "vitest";
import { bracketFor } from "../../src/challonge/challonge.js";
import { clientToolDefs, runClientTool } from "../../src/responders/clientTools.js";
import type { AskContext } from "../../src/types.js";
import { matchesForAsker } from "../../src/wizzrobe/mine.js";

vi.mock("../../src/wizzrobe/mine.js", () => ({ matchesForAsker: vi.fn() }));
vi.mock("../../src/challonge/challonge.js", () => ({ bracketFor: vi.fn() }));

const mineMock = vi.mocked(matchesForAsker);
const bracketMock = vi.mocked(bracketFor);

const ctx: AskContext = {
  requestId: "r",
  asker: { discordUserId: "1", discordName: "me", guildId: null, channelId: "2", linked: null },
  question: "q",
  now: new Date("2026-10-15T12:00:00Z"),
  ephemeral: true,
};

beforeEach(() => {
  mineMock.mockReset();
  bracketMock.mockReset();
});

describe("clientToolDefs", () => {
  it("returns strict schemas with bounds", () => {
    const defs = clientToolDefs(["matches_for_me", "challonge_bracket"]);
    expect(defs).toHaveLength(2);
    for (const d of defs) {
      expect(d.strict).toBe(true);
      expect(d.input_schema.additionalProperties).toBe(false);
    }
    expect(defs[0]?.input_schema.properties).toEqual({
      days_ahead: { type: "integer", minimum: 1, maximum: 14 },
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
    expect(out.partial).toBe(false);
  });

  it("maps id_unreliable to needs_link", async () => {
    mineMock.mockResolvedValue("id_unreliable");
    expect(await runClientTool("matches_for_me", { days_ahead: 3 }, ctx)).toBe(
      '{"needs_link":true}',
    );
  });

  it("challonge_bracket validates and delegates", async () => {
    bracketMock.mockResolvedValue({ tournament: "T" } as never);
    expect(await runClientTool("challonge_bracket", { tournament_id: "x" }, ctx)).toBe(
      '{"error":"invalid input"}',
    );
    expect(await runClientTool("challonge_bracket", { tournament_id: 9 }, ctx)).toBe(
      '{"tournament":"T"}',
    );
    expect(bracketMock).toHaveBeenCalledWith(9);
  });
});
