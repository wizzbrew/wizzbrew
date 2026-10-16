import { waitUntil } from "@vercel/functions";
import type { APIInteraction } from "discord-api-types/v10";
import { checkConfig, config } from "../src/config.js";
import { verifyDiscordRequest } from "../src/discord/verify.js";
import { handleInteraction } from "../src/handlers/dispatch.js";
import { log } from "../src/log.js";

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) {
    return new Response("invalid request signature", { status: 401 });
  }

  let publicKey: string;
  try {
    publicKey = config().discordPublicKey;
  } catch {
    log("error", "interactions.config_error", { problems: checkConfig().problems });
    return new Response("server error", { status: 500 });
  }

  if (!(await verifyDiscordRequest(raw, signature, timestamp, publicKey))) {
    return new Response("invalid request signature", { status: 401 });
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: APIInteraction;
  try {
    interaction = JSON.parse(raw) as APIInteraction;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (interaction === null || typeof interaction !== "object") {
    return new Response("bad request", { status: 400 });
  }

  if (interaction.type === 1) return Response.json({ type: 1 });
  return handleInteraction(interaction, waitUntil);
}
