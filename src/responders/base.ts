import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { WRITE_ARGS } from "../actions/execute.js";
import { config } from "../config.js";
import { sanitizeForPrompt } from "../discord/markup.js";
import { ModelOutputError } from "../errors.js";
import { type BetaMessageCreateParams, createMessage, textOf } from "../llm/client.js";
import { log } from "../log.js";
import { voice } from "../personality/voice.js";
import { ROUTES, type RouteSpec } from "../router/routes.js";
import { nowBlock } from "../time/time.js";
import type { Answer, AskContext, ProposedAction, Route, RoutingDecision } from "../types.js";
import { callTool, connectorParams } from "../wizzrobe/mcp.js";
import { botAccessToken, userAccessToken } from "../wizzrobe/tokens.js";
import { clientToolDefs, runClientTool } from "./clientTools.js";
import { SHARED_RULES, SPECS } from "./specs.js";

const MAX_CALLS = 8;
const MAX_MS = 200_000;

type SystemBlocks = NonNullable<BetaMessageCreateParams["system"]>;
type Tools = NonNullable<BetaMessageCreateParams["tools"]>;

function volatileBlock(ctx: AskContext, decision: RoutingDecision, extra: string[]): string {
  const cfg = config();
  const linked = ctx.asker.linked;
  const lines = [
    nowBlock(ctx.now),
    `Community timezone: ${cfg.communityTimezone}`,
    `Wizzrobe tenant: ${cfg.wizzrobeTenant} (pass it as tenant on every Wizzrobe tool call)`,
    `Asker: ${ctx.asker.discordName}, Discord id ${ctx.asker.discordUserId}`,
    linked
      ? `Linked Wizzrobe account: ${linked.wizzrobeUsername} (user id ${linked.wizzrobeUserId}), roles: ${
          linked.roles.length > 0 ? linked.roles.join(", ") : "none"
        }`
      : "Not linked to Wizzrobe",
    `Params: ${JSON.stringify(decision.params)}`,
    ...extra,
  ];
  return lines.join("\n");
}

function userText(ctx: AskContext): string {
  let out = "";
  if (ctx.history.length > 0) {
    const lines = ctx.history.map(
      (t) => `${t.role === "user" ? "User" : "Wizzbrew"}: ${sanitizeForPrompt(t.text, 600)}`,
    );
    out = `Earlier in this conversation:\n${lines.join("\n")}\n\n`;
  }
  return out + sanitizeForPrompt(ctx.question);
}

function namesOf(result: unknown): string[] {
  const list = Array.isArray(result)
    ? result
    : typeof result === "object" && result !== null
      ? (Object.values(result as Record<string, unknown>).find(Array.isArray) ?? [])
      : [];
  return (list as unknown[]).flatMap((e) => {
    const rec = (e ?? {}) as { name?: unknown; stream_url?: unknown; streamUrl?: unknown };
    if (typeof rec.name !== "string") return [];
    const url = rec.stream_url ?? rec.streamUrl;
    return [typeof url === "string" && url !== "" ? `${rec.name} (${url})` : rec.name];
  });
}

type Settled = { ok: true; r: unknown } | { ok: false };

function settle(p: Promise<unknown>): Promise<Settled> {
  return p.then(
    (r) => ({ ok: true as const, r }),
    () => ({ ok: false as const }),
  );
}

async function eventBlock(): Promise<string[]> {
  const out: string[] = [];
  try {
    const bot = await botAccessToken();
    const [tournaments, stages] = await Promise.all([
      settle(callTool(bot, "list_tournaments", { active_only: true })),
      settle(callTool(bot, "list_stages", { active_only: true })),
    ]);
    if (tournaments.ok) {
      out.push(`Tournaments: ${namesOf(tournaments.r).join("; ") || "none"}`);
    } else {
      log("warn", "responder.event_block", { part: "tournaments" });
    }
    if (stages.ok) {
      out.push(`Stages: ${namesOf(stages.r).join("; ") || "none"}`);
    } else {
      log("warn", "responder.event_block", { part: "stages" });
    }
  } catch {
    log("warn", "responder.event_block", { part: "token" });
  }
  return out;
}

function interactionTools(r: RouteSpec): BetaTool[] {
  const tools: BetaTool[] = [
    {
      name: "offer_choices",
      description:
        "Ask the asker to pick when a name matches more than one thing. Ends the answer.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          choices: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              properties: { label: { type: "string" }, value: { type: "string" } },
              required: ["label", "value"],
              additionalProperties: false,
            },
          },
        },
        required: ["prompt", "choices"],
        additionalProperties: false,
      },
    },
  ];
  if (r.writeTools.length > 0) {
    tools.push({
      name: "propose_action",
      description:
        "Propose one write for the asker to confirm. Nothing runs until they press Confirm. Ends the answer.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          tool: { type: "string", enum: [...r.writeTools] },
          args_json: {
            type: "string",
            description: "The tool's arguments as a JSON object, no tenant",
          },
          summary: {
            type: "string",
            description: "Plain words, times as <t:EPOCH:f>",
          },
        },
        required: ["tool", "args_json", "summary"],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

const choicesInput = z
  .object({
    prompt: z.string(),
    choices: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .min(1)
      .max(5),
  })
  .strict();

const proposeInput = z
  .object({ tool: z.string(), args_json: z.string(), summary: z.string() })
  .strict();

function issuePaths(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

function toolError(id: string, text: string): BetaToolResultBlockParam {
  return { type: "tool_result", tool_use_id: id, content: text, is_error: true };
}

export async function runResponder(
  route: Route,
  decision: RoutingDecision,
  ctx: AskContext,
): Promise<Answer> {
  if (route === "live" || route === "account") {
    throw new Error(`route ${route} has no responder`);
  }
  if (route === "staff") {
    return { text: "Staff tools aren't in Wizzbrew yet. Use Wizzrobe directly.", ephemeral: true };
  }
  const started = Date.now();
  const deadline = started + 240_000;
  const spec = SPECS[route];
  const r = ROUTES[route];
  const ephemeral = r.ephemeral || ctx.ephemeral;

  const extra = route === "chat" ? await eventBlock() : [];
  const system = [
    {
      type: "text",
      text: `${voice(spec.register)}\n\n${SHARED_RULES}\n\n${spec.instructions}`,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: volatileBlock(ctx, decision, extra) },
  ] as SystemBlocks;
  const messages: BetaMessageParam[] = [
    { role: "user", content: [{ type: "text", text: userText(ctx) }] },
  ];

  const noTools =
    r.readTools.length === 0 && r.clientTools.length === 0 && r.writeTools.length === 0;
  if (noTools) {
    const msg = await createMessage(
      "chat",
      { max_tokens: 4000, system, messages, output_config: { effort: "low" } },
      { ...ctx, deadline },
    );
    const text = textOf(msg);
    if (text === "") throw new ModelOutputError("empty", "the answer came back empty");
    log("info", "responder.done", {
      requestId: ctx.requestId,
      route,
      calls: 1,
      ms: Date.now() - started,
      tools: [],
    });
    return { text, ephemeral };
  }

  const token =
    r.auth === "public" ? await botAccessToken() : await userAccessToken(ctx.asker.discordUserId);
  const conn = connectorParams(token, r.readTools);
  const tools = [...conn.tools, ...clientToolDefs(r.clientTools), ...interactionTools(r)] as Tools;
  const clientNames = new Set<string>(r.clientTools);
  const used: string[] = [];

  const done = (calls: number): void =>
    log("info", "responder.done", {
      requestId: ctx.requestId,
      route,
      calls,
      ms: Date.now() - started,
      tools: used,
    });

  for (let calls = 1; calls <= MAX_CALLS; calls++) {
    if (Date.now() - started > MAX_MS) {
      throw new ModelOutputError("timeout", "that took too long");
    }
    const msg = await createMessage(
      "responder",
      {
        max_tokens: 16000,
        system,
        tools,
        mcp_servers: conn.mcp_servers,
        betas: conn.betas,
        messages,
        output_config: { effort: "medium" },
      } as Parameters<typeof createMessage>[1],
      { ...ctx, deadline },
    );
    messages.push({ role: "assistant", content: msg.content as BetaContentBlock[] });
    for (const b of msg.content) {
      if (b.type === "mcp_tool_use") used.push(b.name);
    }

    if (msg.stop_reason === "pause_turn") continue;

    const uses = msg.content.filter((b) => b.type === "tool_use");
    if (uses.length > 0) {
      const results: BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        used.push(u.name);
        if (clientNames.has(u.name)) {
          const content = await runClientTool(u.name as never, u.input, ctx);
          results.push({ type: "tool_result", tool_use_id: u.id, content });
        } else if (u.name === "offer_choices") {
          const p = choicesInput.safeParse(u.input);
          if (!p.success) {
            results.push(toolError(u.id, `invalid input: ${issuePaths(p.error)}`));
            continue;
          }
          done(calls);
          return { text: p.data.prompt, choices: p.data.choices, ephemeral };
        } else if (u.name === "propose_action" && r.writeTools.length > 0) {
          const p = proposeInput.safeParse(u.input);
          const tool = p.success ? r.writeTools.find((w) => w === p.data.tool) : undefined;
          if (!p.success || tool === undefined) {
            results.push(toolError(u.id, "invalid input: tool is not allowed on this route"));
            continue;
          }
          let raw: unknown;
          try {
            raw = JSON.parse(p.data.args_json);
          } catch {
            results.push(toolError(u.id, "invalid input: args_json is not valid JSON"));
            continue;
          }
          const args = WRITE_ARGS[tool].safeParse(raw);
          if (!args.success) {
            results.push(toolError(u.id, `invalid input: ${issuePaths(args.error)}`));
            continue;
          }
          const proposedAction: ProposedAction = {
            tool,
            args: args.data as Record<string, unknown>,
            summary: p.data.summary,
          };
          done(calls);
          return { text: p.data.summary, proposedAction, ephemeral };
        } else {
          results.push(toolError(u.id, "unknown tool"));
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    if (msg.stop_reason === "end_turn" || msg.stop_reason === "stop_sequence") {
      const text = textOf(msg);
      if (text === "") throw new ModelOutputError("empty", "the answer came back empty");
      done(calls);
      return { text, ephemeral };
    }
  }
  throw new ModelOutputError("iteration_cap", "the answer took too many steps");
}
