import { z } from "zod";
import { sanitizeForPrompt } from "../discord/markup.js";
import { ModelOutputError, UserInputError } from "../errors.js";
import { GAME_IDS } from "../game/catalog.js";
import { ROUTINE_NAMES } from "../game/routines.js";
import { createMessage, textOf } from "../llm/client.js";
import { log } from "../log.js";
import { nowBlock, parseUserDate } from "../time/time.js";
import type { AskContext, Route, RoutingDecision } from "../types.js";
import { ROUTER_PROMPT } from "./prompt.js";
import { ROUTES } from "./routes.js";

const MIN_CONFIDENCE = 0.5;

const ROUTE_NAMES = Object.keys(ROUTES) as [Route, ...Route[]];

type FailureKind = "refusal" | "max_tokens" | "bad_json" | "bad_shape";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

// The JSON schema the model must follow (structured output). The zod schema below checks the
// same shape again in code, because the output is still untrusted text (L10).
export const ROUTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["route", "confidence", "params", "reason"],
  properties: {
    route: { type: "string", enum: ROUTE_NAMES },
    confidence: { type: "number" },
    reason: { type: "string" },
    params: {
      type: "object",
      additionalProperties: false,
      required: [
        "day",
        "tournament",
        "player",
        "stage",
        "matchId",
        "accountAction",
        "routine",
        "subjects",
        "game",
      ],
      properties: {
        day: nullableString,
        tournament: nullableString,
        player: nullableString,
        stage: nullableString,
        matchId: { anyOf: [{ type: "integer" }, { type: "null" }] },
        accountAction: {
          anyOf: [{ type: "string", enum: ["link", "unlink"] }, { type: "null" }],
        },
        routine: { anyOf: [{ type: "string", enum: ROUTINE_NAMES }, { type: "null" }] },
        // The schema cannot cap the length (structured output allows no maxItems); zod keeps four.
        subjects: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
        game: { anyOf: [{ type: "string", enum: GAME_IDS }, { type: "null" }] },
      },
    },
  },
};

const MAX_SUBJECTS = 4;

// Never rejects a decision: anything that is not a list is ignored, entries that are not
// non-empty strings are dropped, and only the first four names are kept.
const Subjects = z
  .unknown()
  .transform((value): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((s): s is string => typeof s === "string" && s.trim() !== "")
      .slice(0, MAX_SUBJECTS);
  })
  .optional();

const RouterOutput = z.object({
  route: z.enum(ROUTE_NAMES),
  confidence: z.number(),
  reason: z.string(),
  params: z.object({
    day: z.string().nullish(),
    tournament: z.string().nullish(),
    player: z.string().nullish(),
    stage: z.string().nullish(),
    matchId: z.number().int().nullish(),
    accountAction: z.enum(["link", "unlink"]).nullish(),
    routine: z.enum(ROUTINE_NAMES).nullish(),
    subjects: Subjects,
    game: z.enum(GAME_IDS).nullish(),
  }),
});

function failed(kind: FailureKind): RoutingDecision {
  return { route: "chat", confidence: 0, params: {}, reason: `router failed: ${kind}` };
}

function failureKind(err: ModelOutputError): FailureKind {
  if (err.stopReason === "refusal") return "refusal";
  if (err.stopReason === "max_tokens") return "max_tokens";
  return "bad_shape";
}

// A null or empty param is absent. Names stay exactly as the model copied them (L18).
function text(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value.trim() === "" ? undefined : value;
}

function historyBlock(ctx: AskContext): string {
  if (ctx.history.length === 0) return "";
  const lines = ctx.history.map(
    (turn) => `${turn.role === "user" ? "User" : "Wizzbrew"}: ${sanitizeForPrompt(turn.text, 500)}`,
  );
  return `Earlier in this conversation:\n${lines.join("\n")}\n\n`;
}

export async function routeQuestion(ctx: AskContext): Promise<RoutingDecision> {
  let raw: string;
  try {
    const msg = await createMessage(
      "router",
      {
        max_tokens: 4000,
        // The clock lives in the user turn only, so the cached system block never changes (L1).
        system: [
          { type: "text", text: ROUTER_PROMPT, cache_control: { type: "ephemeral", ttl: "1h" } },
        ],
        messages: [
          {
            role: "user",
            content: `${nowBlock(ctx.now)}\nAsker linked: ${ctx.asker.linked ? "yes" : "no"}\n\n${historyBlock(ctx)}${sanitizeForPrompt(ctx.question)}`,
          },
        ],
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: ROUTER_SCHEMA },
        },
      },
      { requestId: ctx.requestId, now: ctx.now },
    );
    raw = textOf(msg);
  } catch (err) {
    if (err instanceof ModelOutputError) {
      const kind = failureKind(err);
      log("warn", "router.failed", { requestId: ctx.requestId, kind, stopReason: err.stopReason });
      return failed(kind);
    }
    throw err; // budget and SDK errors are not a routing answer (L16)
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    log("warn", "router.failed", { requestId: ctx.requestId, kind: "bad_json" });
    return failed("bad_json");
  }
  const parsed = RouterOutput.safeParse(json);
  if (!parsed.success) {
    log("warn", "router.failed", { requestId: ctx.requestId, kind: "bad_shape" });
    return failed("bad_shape");
  }

  const out = parsed.data;
  const confidence = Math.min(1, Math.max(0, out.confidence));
  let reason = out.reason;
  const params: RoutingDecision["params"] = {};

  const day = text(out.params.day);
  if (day !== undefined) {
    try {
      params.day = parseUserDate(day, ctx.now);
    } catch (err) {
      if (!(err instanceof UserInputError)) throw err;
      reason = `${reason}; day unreadable`;
    }
  }
  const tournament = text(out.params.tournament);
  if (tournament !== undefined) params.tournament = tournament;
  const player = text(out.params.player);
  if (player !== undefined) params.player = player;
  const stage = text(out.params.stage);
  if (stage !== undefined) params.stage = stage;
  if (out.params.matchId !== null && out.params.matchId !== undefined) {
    params.matchId = out.params.matchId;
  }

  if (out.params.accountAction) params.accountAction = out.params.accountAction;

  // The game params mean something only on the game route; elsewhere they stay out of the
  // decision, so no other responder's context block carries them.
  if (out.route === "game") {
    if (out.params.routine) params.routine = out.params.routine;
    if (out.params.subjects && out.params.subjects.length > 0) {
      params.subjects = out.params.subjects;
    }
    if (out.params.game) params.game = out.params.game;
  }

  if (confidence >= MIN_CONFIDENCE && out.route === "account" && !params.accountAction) {
    const missing: RoutingDecision = {
      route: "chat",
      confidence,
      params: {},
      reason: "account action missing",
    };
    log("info", "router.decision", {
      requestId: ctx.requestId,
      route: missing.route,
      confidence: missing.confidence,
      params: missing.params,
      reason: missing.reason,
    });
    return missing;
  }

  const decision: RoutingDecision =
    confidence < MIN_CONFIDENCE
      ? { route: "chat", confidence, params: {}, reason }
      : { route: out.route, confidence, params, reason };

  log("info", "router.decision", {
    requestId: ctx.requestId,
    route: decision.route,
    confidence: decision.confidence,
    params: decision.params,
    reason: decision.reason,
  });
  return decision;
}
