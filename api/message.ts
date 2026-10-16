import { createHmac, timingSafeEqual } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { config } from "../src/config.js";
import { deliverError } from "../src/handlers/deliver.js";
import { runMessagePipeline } from "../src/handlers/message.js";
import { log } from "../src/log.js";
import { isPaused } from "../src/ops/alerts.js";
import { keys } from "../src/store/keys.js";
import { kv } from "../src/store/kv.js";

const MAX_SKEW_SEC = 300;

const relayMessageSchema = z
  .object({
    messageId: z.string().min(1),
    channelId: z.string().min(1),
    guildId: z.string().nullable(),
    isDm: z.boolean(),
    author: z
      .object({
        id: z.string().min(1),
        username: z.string(),
        globalName: z.string().nullable(),
        nick: z.string().nullable(),
      })
      .strict(),
    content: z.string(),
    chain: z
      .array(
        z
          .object({
            authorId: z.string(),
            authorName: z.string(),
            isBot: z.boolean(),
            content: z.string(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

function validSignature(
  secret: string,
  timestamp: string,
  raw: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

const unauthorized = () => new Response("unauthorized", { status: 401 });

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const timestamp = request.headers.get("X-Relay-Timestamp");
  const signature = request.headers.get("X-Relay-Signature");
  if (!timestamp || !signature) return unauthorized();

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SEC) {
    return unauthorized();
  }
  if (!validSignature(config().relaySecret, timestamp, raw, signature)) return unauthorized();

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const parsed = relayMessageSchema.safeParse(body);
  if (!parsed.success) return new Response("bad request", { status: 400 });
  const m = parsed.data;

  const first = await kv().setIfAbsent(keys.cache("msg", m.messageId), 1, 600);
  if (!first) return Response.json({ duplicate: true }, { status: 200 });

  if (await isPaused()) {
    waitUntil(
      deliverError(
        { kind: "message", channelId: m.channelId, messageId: m.messageId },
        "Wizzbrew is paused right now.",
      ).catch((err: unknown) => {
        log("error", "message.paused_reply_failed", {
          error: err instanceof Error ? err.message : "unknown",
        });
      }),
    );
    return Response.json({ paused: true }, { status: 200 });
  }

  const requestId = crypto.randomUUID();
  log("info", "message.accepted", {
    requestId,
    messageId: m.messageId,
    channelId: m.channelId,
    length: m.content.length,
  });
  waitUntil(runMessagePipeline(m, requestId, new Date()));
  return new Response(null, { status: 202 });
}
