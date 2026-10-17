import { createHmac } from "node:crypto";

// Copied from the main app's src/types.ts; the relay cannot import src/.
export interface RelayMessage {
  messageId: string;
  channelId: string;
  guildId: string | null;
  isDm: boolean;
  author: { id: string; username: string; globalName: string | null; nick: string | null };
  content: string;
  chain: { authorId: string; authorName: string; isBot: boolean; content: string }[];
}

export const MAX_CHAIN = 10;

export interface ForwardInputs {
  authorIsBot: boolean;
  isDm: boolean;
  mentionsBot: boolean;
  repliesToBot: boolean;
  channelId: string;
  parentId: string | null;
  isMemberOfAllowedGuild: boolean;
}

export function shouldForward(m: ForwardInputs, allow: Set<string>): boolean {
  if (m.authorIsBot) return false;
  if (m.isDm) return m.isMemberOfAllowedGuild;
  if (!(m.mentionsBot || m.repliesToBot)) return false;
  return allow.has(m.channelId) || (m.parentId !== null && allow.has(m.parentId));
}

export type IgnoreReason =
  | "channel_not_allowed"
  | "not_mention_or_reply"
  | "dm_not_member"
  | "bot_author";

export interface IgnoreInputs extends ForwardInputs {
  // True when the bot's username or display name appears in the text (plain "@Wizzbrew").
  nameInContent: boolean;
}

// Why a message was not forwarded, for diagnosis only. Returns null when the message is
// forwarded, and also when it was ignored but never looked aimed at the bot (not a DM, no
// mention, no reply, no name in the text), so the logs stay quiet about ordinary chatter.
// shouldForward stays the single source of truth for the forward decision.
export function ignoreReason(m: IgnoreInputs, allow: Set<string>): IgnoreReason | null {
  if (shouldForward(m, allow)) return null;
  const aimed = m.isDm || m.mentionsBot || m.repliesToBot || m.nameInContent;
  if (!aimed) return null;
  if (m.authorIsBot) return "bot_author";
  if (m.isDm) return "dm_not_member";
  if (m.mentionsBot || m.repliesToBot) return "channel_not_allowed";
  return "not_mention_or_reply";
}

// Case-insensitive check for any of the bot's names in the text. Only a boolean leaves here;
// the text itself is never logged.
export function mentionsBotName(content: string, names: (string | null | undefined)[]): boolean {
  const haystack = content.toLowerCase();
  return names.some((n) => {
    const needle = n?.trim().toLowerCase();
    return needle !== undefined && needle !== "" && haystack.includes(needle);
  });
}

export interface IgnoredLog {
  reason: IgnoreReason;
  channelId: string;
  guildId: string | null;
  messageId: string;
  authorId: string;
  mention: boolean;
  reply: boolean;
}

// Ids, flags and the reason only. Never message content.
export function formatIgnoredLog(l: IgnoredLog): string {
  return (
    `ignored reason=${l.reason} channel=${l.channelId} guild=${l.guildId ?? "dm"} ` +
    `message=${l.messageId} author=${l.authorId} mention=${l.mention} reply=${l.reply}`
  );
}

// The bot is mentioned by its user or by its own managed (integration) role. The role case is
// matched on the role's bot tag, so other roles the bot happens to hold, @everyone and @here
// never count.
export function isBotMention(
  userMentioned: boolean,
  mentionedRoleBotIds: readonly string[],
  botId: string,
): boolean {
  return userMentioned || mentionedRoleBotIds.includes(botId);
}

// Removes the role mention token for each given role id, e.g. <@&123>.
export function stripRoleMentions(text: string, roleIds: readonly string[]): string {
  let out = text;
  for (const id of roleIds) out = out.replaceAll(`<@&${id}>`, "");
  return out;
}

export function cleanContent(
  text: string,
  botId: string,
  botRoleIds: readonly string[] = [],
): string {
  return stripRoleMentions(text, botRoleIds)
    .replaceAll(`<@${botId}>`, "")
    .replaceAll(`<@!${botId}>`, "")
    .trim()
    .replace(/^@Wizzbrew\b/i, "")
    .trim();
}

export interface BuildInput {
  messageId: string;
  channelId: string;
  guildId: string | null;
  isDm: boolean;
  author: RelayMessage["author"];
  text: string;
  botId: string;
  botRoleIds?: readonly string[]; // the bot's own managed role ids, stripped like <@botId>
  chain: RelayMessage["chain"]; // oldest first
}

export function buildRelayMessage(i: BuildInput): RelayMessage {
  return {
    messageId: i.messageId,
    channelId: i.channelId,
    guildId: i.guildId,
    isDm: i.isDm,
    author: i.author,
    content: cleanContent(i.text, i.botId, i.botRoleIds ?? []),
    chain: i.chain.length > MAX_CHAIN ? i.chain.slice(i.chain.length - MAX_CHAIN) : [...i.chain],
  };
}

export function sign(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
