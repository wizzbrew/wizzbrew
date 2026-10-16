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

export function cleanContent(text: string, botId: string): string {
  return text
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
  chain: RelayMessage["chain"]; // oldest first
}

export function buildRelayMessage(i: BuildInput): RelayMessage {
  return {
    messageId: i.messageId,
    channelId: i.channelId,
    guildId: i.guildId,
    isDm: i.isDm,
    author: i.author,
    content: cleanContent(i.text, i.botId),
    chain: i.chain.length > MAX_CHAIN ? i.chain.slice(i.chain.length - MAX_CHAIN) : [...i.chain],
  };
}

export function sign(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
