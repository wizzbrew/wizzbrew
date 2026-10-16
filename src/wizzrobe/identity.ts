import type { APIInteraction } from "discord-api-types/v10";
import { z } from "zod";
import { config } from "../config.js";
import { NotLinkedError } from "../errors.js";
import { log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import type { Asker, LinkedAccount, LinkRecord } from "../types.js";
import { callTool } from "./mcp.js";
import { userAccessToken } from "./tokens.js";

// Roles refresh at most every 10 minutes.
const ROLES_MAX_AGE_MS = 600_000;

const whoamiSchema = z.object({
  can_write: z.boolean(),
  tenants: z.array(z.object({ slug: z.string(), roles: z.array(z.string()) })),
});

// The only reader and writer of link keys (L19).
export async function getLink(discordUserId: string): Promise<LinkRecord | null> {
  return kv().get<LinkRecord>(keys.link(discordUserId));
}

export async function saveLink(discordUserId: string, rec: LinkRecord): Promise<void> {
  await kv().set(keys.link(discordUserId), rec);
}

export async function deleteLink(discordUserId: string): Promise<void> {
  await kv().del(keys.link(discordUserId));
  await kv().del(keys.userToken(discordUserId));
}

// Re-reads roles and can_write for the configured community and stores them on the record.
async function refreshRoles(discordUserId: string, rec: LinkRecord): Promise<LinkRecord> {
  const raw = await callTool(await userAccessToken(discordUserId), "whoami", {});
  const me = whoamiSchema.parse(raw);
  const slug = config().wizzrobeTenant;
  const tenant = me.tenants.find((t) => t.slug === slug);
  if (!tenant) throw new Error("whoami has no entry for the configured community");
  const next: LinkRecord = {
    ...rec,
    roles: tenant.roles,
    canWrite: me.can_write,
    rolesCheckedAt: Date.now(),
  };
  await saveLink(discordUserId, next);
  return next;
}

function toLinked(rec: LinkRecord): LinkedAccount {
  return {
    wizzrobeUserId: rec.wizzrobeUserId,
    wizzrobeUsername: rec.username,
    roles: rec.roles,
    canWrite: rec.canWrite,
  };
}

export async function loadAsker(i: APIInteraction): Promise<Asker> {
  const user = i.member?.user ?? i.user;
  if (!user) throw new Error("interaction has no user");
  const discordUserId = user.id;
  const asker: Asker = {
    discordUserId,
    discordName: i.member?.nick ?? user.global_name ?? user.username,
    guildId: i.guild_id ?? null,
    channelId: i.channel?.id ?? i.channel_id ?? "",
    linked: null,
  };

  let rec = await getLink(discordUserId);
  if (!rec) return asker;

  if (Date.now() - rec.rolesCheckedAt > ROLES_MAX_AGE_MS) {
    try {
      rec = await refreshRoles(discordUserId, rec);
    } catch (err) {
      if (err instanceof NotLinkedError) return asker;
      log("warn", "identity.roles_refresh_failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  asker.linked = toLinked(rec);
  return asker;
}
