import { afterEach, describe, expect, it, vi } from "vitest";
import { WizzrobeError } from "../../src/errors.js";
import {
  bookBracketGame,
  createRescheduleRequest,
  myOpenBracketMatches,
} from "../../src/wizzrobe/rest.js";
import { FakeWizzrobe } from "../fakes/wizzrobe.js";

const MATCH_ID = 42;
const BRACKET_MATCH_ID = 7;

const rescheduleBody = {
  id: 5,
  match_id: MATCH_ID,
  kind: "reschedule",
  status: "pending",
  reason: "stream clash",
  requested_by_id: 3,
  requested_by_name: "Sample Player",
  created_at: "2026-10-15T10:00:00Z",
  proposed_at: "2026-10-20T18:00:00Z",
  original_scheduled_at: "2026-10-18T18:00:00Z",
  opponent_agreed_at: null,
  decided_by_id: null,
  decided_by_name: null,
  decided_at: null,
  decision_note: null,
};

const bracketMatchBody = {
  id: BRACKET_MATCH_ID,
  bracket_id: 2,
  round: 1,
  position: 1,
  state: "open",
  created_at: "2026-10-15T10:00:00Z",
  updated_at: "2026-10-15T10:05:00Z",
  group_number: null,
  entry1_id: 11,
  entry2_id: 12,
  winner_id: null,
  entry1_score: null,
  entry2_score: null,
  winner_to_id: 8,
  winner_to_slot: 1,
  loser_to_id: null,
  loser_to_slot: null,
  best_of: 3,
  forfeit: false,
  status: null,
  games: [],
};

// A plain fetch stub that answers every call with the given status and JSON body.
function stubFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof stubFetch>): URL {
  return new URL(String(fetchMock.mock.calls[0]?.[0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRescheduleRequest", () => {
  it("POSTs to the match's reschedule route as the caller with a snake_case body", async () => {
    const fake = new FakeWizzrobe();
    vi.stubGlobal("fetch", fake.fetch);

    await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "reschedule",
      reason: "stream clash",
      proposedAt: "2026-10-20T18:00:00Z",
    });

    expect(fake.calls).toEqual([
      {
        tool: `rest:POST /api/matches/${MATCH_ID}/reschedule-requests`,
        token: "tok-1",
        args: { kind: "reschedule", reason: "stream clash", proposed_at: "2026-10-20T18:00:00Z" },
      },
    ]);
  });

  it("omits proposed_at for a cancel even when one is passed", async () => {
    const fake = new FakeWizzrobe();
    vi.stubGlobal("fetch", fake.fetch);

    await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "cancel",
      reason: "player withdrew",
      proposedAt: "2026-10-20T18:00:00Z",
    });

    expect(fake.calls[0]?.args).toEqual({ kind: "cancel", reason: "player withdrew" });
  });

  it("returns the parsed 201 body", async () => {
    stubFetch(201, rescheduleBody);

    const result = await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "reschedule",
      reason: "stream clash",
      proposedAt: "2026-10-20T18:00:00Z",
    });

    expect(result).toEqual(rescheduleBody);
  });
});

describe("bookBracketGame", () => {
  it("POSTs the booking to the bracket match's games route with snake_case keys", async () => {
    const fake = new FakeWizzrobe();
    vi.stubGlobal("fetch", fake.fetch);

    await bookBracketGame("tok-2", BRACKET_MATCH_ID, {
      scheduledDate: "2026-10-20",
      scheduledTime: "18:00",
      comment: "Please stream",
    });

    expect(fake.calls).toEqual([
      {
        tool: `rest:POST /api/brackets/matches/${BRACKET_MATCH_ID}/games`,
        token: "tok-2",
        args: { scheduled_date: "2026-10-20", scheduled_time: "18:00", comment: "Please stream" },
      },
    ]);
  });

  it("omits comment when none is given", async () => {
    const fake = new FakeWizzrobe();
    vi.stubGlobal("fetch", fake.fetch);

    await bookBracketGame("tok-2", BRACKET_MATCH_ID, {
      scheduledDate: "2026-10-20",
      scheduledTime: "18:00",
    });

    expect(fake.calls[0]?.args).toEqual({ scheduled_date: "2026-10-20", scheduled_time: "18:00" });
  });

  it("returns the parsed 201 match", async () => {
    stubFetch(201, bracketMatchBody);

    const result = await bookBracketGame("tok-2", BRACKET_MATCH_ID, {
      scheduledDate: "2026-10-20",
      scheduledTime: "18:00",
    });

    expect(result).toEqual(bracketMatchBody);
  });
});

describe("myOpenBracketMatches", () => {
  it("returns the array from GET my-open-matches with no query when no tournament is given", async () => {
    const fetchMock = stubFetch(200, [bracketMatchBody]);

    const result = await myOpenBracketMatches("tok-3");

    expect(result).toEqual([bracketMatchBody]);
    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/brackets/my-open-matches");
    expect(url.search).toBe("");
  });

  it("adds tournament_id to the query when a tournament is given", async () => {
    const fetchMock = stubFetch(200, []);

    await myOpenBracketMatches("tok-3", 9);

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/brackets/my-open-matches");
    expect(url.searchParams.get("tournament_id")).toBe("9");
  });
});

describe("REST errors", () => {
  it("maps a 400 with a detail string to WizzrobeError 400 carrying that detail", async () => {
    const fake = new FakeWizzrobe();
    fake.failRest(`/api/matches/${MATCH_ID}/reschedule-requests`, 400, "Match is locked");
    vi.stubGlobal("fetch", fake.fetch);

    const error = await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "cancel",
      reason: "late",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WizzrobeError);
    expect(error).toMatchObject({ status: 400 });
    expect((error as Error).message).toBe("Match is locked");
  });

  it("maps a 429 with Retry-After 7 to status 429 and retryAfterSec 7", async () => {
    const fake = new FakeWizzrobe();
    fake.failRest(`/api/matches/${MATCH_ID}/reschedule-requests`, 429, "Slow down", 7);
    vi.stubGlobal("fetch", fake.fetch);

    const error = await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "cancel",
      reason: "late",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WizzrobeError);
    expect(error).toMatchObject({ status: 429, retryAfterSec: 7 });
  });

  it("maps a 422 to status 400 with the validation messages joined", async () => {
    stubFetch(422, {
      detail: [
        { loc: ["body", "reason"], msg: "Field required", type: "missing" },
        {
          loc: ["body", "kind"],
          msg: "Input should be 'reschedule' or 'cancel'",
          type: "literal_error",
        },
      ],
    });

    const error = await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "cancel",
      reason: "",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WizzrobeError);
    expect(error).toMatchObject({ status: 400 });
    expect((error as Error).message).toBe(
      "Field required; Input should be 'reschedule' or 'cancel'",
    );
  });

  it("maps a malformed 201 to 502", async () => {
    stubFetch(201, { id: "not-a-number" });

    const error = await createRescheduleRequest("tok-1", MATCH_ID, {
      kind: "cancel",
      reason: "late",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WizzrobeError);
    expect(error).toMatchObject({ status: 502 });
    expect((error as Error).message).toBe("Wizzrobe sent an unexpected reply");
  });

  it("maps a network failure to 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const error = await myOpenBracketMatches("tok-3").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WizzrobeError);
    expect(error).toMatchObject({ status: 503 });
    expect((error as Error).message).toBe("could not reach Wizzrobe");
  });
});
