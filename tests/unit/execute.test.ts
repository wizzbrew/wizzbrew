import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAction, WRITE_ARGS } from "../../src/actions/execute.js";
import { UserInputError, WizzrobeError } from "../../src/errors.js";
import type { PendingAction, WriteTool } from "../../src/types.js";
import { callTool } from "../../src/wizzrobe/mcp.js";
import { bookBracketGame, createRescheduleRequest } from "../../src/wizzrobe/rest.js";

vi.mock("../../src/wizzrobe/tokens.js", () => ({
  userAccessToken: vi.fn(async () => "user-token"),
}));
vi.mock("../../src/wizzrobe/mcp.js", () => ({ callTool: vi.fn() }));
vi.mock("../../src/wizzrobe/rest.js", () => ({
  createRescheduleRequest: vi.fn(),
  bookBracketGame: vi.fn(),
}));

const valid: Record<WriteTool, Record<string, unknown>> = {
  acknowledge_match: { match_id: 5 },
  offer_match_for_stream: { match_id: 5 },
  withdraw_stream_offer: { match_id: 5 },
  watch_match: { match_id: 5 },
  unwatch_match: { match_id: 5 },
  signup_as_crew: { match_id: 5, role: "tracker" },
  withdraw_crew_signup: { match_id: 5, role: "commentator" },
  sign_up_for_tournament: { tournament_id: 3 },
  withdraw_from_tournament: { tournament_id: 3 },
  submit_match_request: {
    tournament_id: 3,
    scheduled_date: "2026-10-16",
    scheduled_time: "14:30",
    player_ids: [1, 2],
    comment: "hi",
  },
  rest_create_reschedule_request: {
    match_id: 5,
    kind: "reschedule",
    reason: "conflict",
    proposed_at: "2026-10-16T18:00:00Z",
  },
  rest_book_bracket_game: {
    bracket_match_id: 9,
    scheduled_date: "2026-10-16",
    scheduled_time: "14:30",
  },
};

const ID_KEYS = ["match_id", "tournament_id", "bracket_match_id"];

function pending(tool: WriteTool, args: Record<string, unknown> = valid[tool]): PendingAction {
  return {
    id: "abc",
    tool,
    args,
    summary: "s",
    discordUserId: "111111111111111111",
    createdAt: 0,
    expiresAt: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WRITE_ARGS", () => {
  for (const tool of Object.keys(valid) as WriteTool[]) {
    describe(tool, () => {
      const schema = WRITE_ARGS[tool];
      it("accepts a valid shape", () => {
        expect(schema.safeParse(valid[tool]).success).toBe(true);
      });
      it("rejects a tenant key and an unknown key", () => {
        expect(schema.safeParse({ ...valid[tool], tenant: "x" }).success).toBe(false);
        expect(schema.safeParse({ ...valid[tool], extra: 1 }).success).toBe(false);
      });
      it("rejects a missing id and a string id", () => {
        const key = ID_KEYS.find((k) => k in valid[tool]) as string;
        const { [key]: _gone, ...missing } = valid[tool];
        expect(schema.safeParse(missing).success).toBe(false);
        expect(schema.safeParse({ ...valid[tool], [key]: "5" }).success).toBe(false);
      });
    });
  }

  it("checks date, time, players and reason", () => {
    const s = WRITE_ARGS.submit_match_request;
    expect(s.safeParse({ ...valid.submit_match_request, scheduled_time: "24:00" }).success).toBe(
      false,
    );
    expect(s.safeParse({ ...valid.submit_match_request, scheduled_date: "10/16" }).success).toBe(
      false,
    );
    expect(s.safeParse({ ...valid.submit_match_request, player_ids: [1] }).success).toBe(false);
    expect(
      WRITE_ARGS.rest_create_reschedule_request.safeParse({
        match_id: 5,
        kind: "cancel",
        reason: "",
      }).success,
    ).toBe(false);
  });
});

describe("executeAction", () => {
  it("rejects bad args without calling anything", async () => {
    await expect(executeAction(pending("watch_match", { match_id: "5" }))).rejects.toBeInstanceOf(
      UserInputError,
    );
    expect(callTool).not.toHaveBeenCalled();
  });

  it("calls an MCP tool with the user token", async () => {
    const line = await executeAction(pending("signup_as_crew"));
    expect(callTool).toHaveBeenCalledWith("user-token", "signup_as_crew", valid.signup_as_crew);
    expect(line).toBe("Signed you up as tracker for match 5. Staff may need to approve it.");
  });

  it("maps the reschedule body", async () => {
    const line = await executeAction(pending("rest_create_reschedule_request"));
    expect(createRescheduleRequest).toHaveBeenCalledWith("user-token", 5, {
      kind: "reschedule",
      reason: "conflict",
      proposedAt: "2026-10-16T18:00:00Z",
    });
    expect(callTool).not.toHaveBeenCalled();
    expect(line).toBe("Sent your reschedule request for match 5. Staff will decide.");
  });

  it("maps the bracket game body", async () => {
    const line = await executeAction(pending("rest_book_bracket_game"));
    expect(bookBracketGame).toHaveBeenCalledWith("user-token", 9, {
      scheduledDate: "2026-10-16",
      scheduledTime: "14:30",
      comment: undefined,
    });
    expect(line).toBe("Booked the next game for 2026-10-16 14:30.");
  });

  it("propagates a WizzrobeError", async () => {
    vi.mocked(callTool).mockRejectedValueOnce(new WizzrobeError(403, "no"));
    await expect(executeAction(pending("acknowledge_match"))).rejects.toBeInstanceOf(WizzrobeError);
  });

  it("words every result", async () => {
    const lines: Record<string, string> = {
      acknowledge_match: "Acknowledged match 5.",
      offer_match_for_stream:
        "Offered match 5 for stream. Stream managers decide what goes on air.",
      withdraw_stream_offer: "Withdrew your stream offer for match 5.",
      watch_match: "You'll get Wizzrobe DMs when match 5 changes.",
      unwatch_match: "Stopped watching match 5.",
      withdraw_crew_signup: "Withdrew your commentator signup for match 5.",
      sign_up_for_tournament: "Entered you in tournament 3.",
      withdraw_from_tournament: "Withdrew you from tournament 3.",
      submit_match_request:
        "Sent your match request for 2026-10-16 14:30. Staff will approve or decline it.",
    };
    for (const [tool, want] of Object.entries(lines)) {
      expect(await executeAction(pending(tool as WriteTool))).toBe(want);
    }
  });
});
