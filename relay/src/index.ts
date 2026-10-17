import { Client, cleanContent, GatewayIntentBits, type Message, Partials } from "discord.js";
import { loadConfig } from "./config.js";
import {
  buildRelayMessage,
  formatIgnoredLog,
  ignoreReason,
  isBotMention,
  MAX_CHAIN,
  mentionsBotName,
  type RelayMessage,
  shouldForward,
  sign,
  stripRoleMentions,
} from "./forward.js";

const config = loadConfig();
const FAIL_TEXT = "I can't answer right now. Try again in a minute.";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

function nameOf(m: Message): string {
  return m.member?.displayName ?? m.author.globalName ?? m.author.username;
}

async function fetchRef(m: Message): Promise<Message | null> {
  const id = m.reference?.messageId;
  if (!id) return null;
  try {
    return await m.channel.messages.fetch(id);
  } catch (err) {
    console.warn(
      `fetchRef failed message=${m.id} error=${err instanceof Error ? err.name : "unknown"}`,
    );
    return null;
  }
}

const MEMBER_TTL_MS = 10 * 60 * 1000;
const memberCache = new Map<string, { value: boolean; expires: number }>();
let allowedGuildIds: string[] = [];

function resolveAllowedGuilds(): void {
  const ids = new Set<string>();
  for (const channelId of config.channelIds) {
    const ch = client.channels.cache.get(channelId);
    if (ch && "guildId" in ch && typeof ch.guildId === "string") ids.add(ch.guildId);
  }
  allowedGuildIds = [...ids];
}

async function isMemberOfAllowedGuild(authorId: string): Promise<boolean> {
  const hit = memberCache.get(authorId);
  if (hit && hit.expires > Date.now()) return hit.value;
  let value = false;
  for (const guildId of allowedGuildIds) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        await guild.members.fetch(authorId);
        value = true;
        break;
      }
    } catch {
      // Unknown member in this guild; try the next one.
    }
  }
  memberCache.set(authorId, { value, expires: Date.now() + MEMBER_TTL_MS });
  return value;
}

async function walkChain(m: Message): Promise<RelayMessage["chain"]> {
  const newestFirst: RelayMessage["chain"] = [];
  let cur: Message | null = m;
  while (newestFirst.length < MAX_CHAIN) {
    cur = await fetchRef(cur);
    if (!cur) break;
    newestFirst.push({
      authorId: cur.author.id,
      authorName: nameOf(cur),
      isBot: cur.author.bot,
      content: cur.cleanContent,
    });
  }
  return newestFirst.reverse();
}

async function post(msg: RelayMessage): Promise<number> {
  const body = JSON.stringify(msg);
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${config.baseUrl}/api/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relay-Timestamp": ts,
      "X-Relay-Signature": sign(config.secret, ts, body),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  return res.status;
}

client.on("messageCreate", async (message) => {
  const botId = client.user?.id;
  if (!botId) return;
  // The bot's own posts are never forwarded and never worth a log line.
  if (message.author.id === botId) return;
  try {
    const isDm = message.guildId === null;
    let repliesToBot = false;
    if (!message.author.bot && message.reference?.messageId) {
      const ref = await fetchRef(message);
      repliesToBot = ref?.author.id === botId;
    }
    const channel = message.channel;
    const parentId = channel.isThread() ? channel.parentId : null;
    const memberOk = isDm ? await isMemberOfAllowedGuild(message.author.id) : false;
    const inputs = {
      authorIsBot: message.author.bot,
      isDm,
      mentionsBot: isBotMention(
        message.mentions.users.has(botId),
        message.mentions.roles.map((r) => r.tags?.botId).filter((id) => id !== undefined),
        botId,
      ),
      repliesToBot,
      channelId: message.channelId,
      parentId,
      isMemberOfAllowedGuild: memberOk,
    };
    if (!shouldForward(inputs, config.channelIds)) {
      const reason = ignoreReason(
        {
          ...inputs,
          nameInContent: mentionsBotName(message.content, [
            client.user?.username,
            client.user?.displayName,
            message.guild?.members.me?.displayName,
          ]),
        },
        config.channelIds,
      );
      if (reason) {
        console.log(
          formatIgnoredLog({
            reason,
            channelId: message.channelId,
            guildId: message.guildId,
            messageId: message.id,
            authorId: message.author.id,
            mention: inputs.mentionsBot,
            reply: inputs.repliesToBot,
          }),
        );
      }
      return;
    }

    if ("sendTyping" in channel) await channel.sendTyping().catch(() => undefined);
    const chain = await walkChain(message);
    // Only the bot's own managed role, never another role the bot holds.
    const botRoleIds = [...message.mentions.roles.filter((r) => r.tags?.botId === botId).keys()];
    const relay = buildRelayMessage({
      messageId: message.id,
      channelId: message.channelId,
      guildId: message.guildId,
      isDm,
      author: {
        id: message.author.id,
        username: message.author.username,
        globalName: message.author.globalName,
        nick: message.member?.nickname ?? null,
      },
      text: cleanContent(stripRoleMentions(message.content, botRoleIds), message.channel),
      botId,
      botRoleIds,
      chain,
    });

    let status = 0;
    try {
      status = await post(relay);
    } catch {
      status = 0;
    }
    console.log(`forward channel=${message.channelId} message=${message.id} status=${status}`);
    if (status < 200 || status >= 300) {
      await message.reply({ content: FAIL_TEXT, allowedMentions: { parse: [] } });
    }
  } catch (err) {
    console.error("relay error", err instanceof Error ? err.name : "unknown");
  }
});

client.once("clientReady", () => {
  resolveAllowedGuilds();
  console.log(`relay ready guilds=${client.guilds.cache.size} channels=${config.channelIds.size}`);
});

// Gateway connection events, so a dead connection shows up in the logs. Ids and codes only.
client.on("shardDisconnect", (event, shardId) => {
  console.warn(`gateway shardDisconnect shard=${shardId} code=${event.code}`);
});
client.on("shardReconnecting", (shardId) => {
  console.warn(`gateway shardReconnecting shard=${shardId}`);
});
client.on("shardResume", (shardId) => {
  console.log(`gateway shardResume shard=${shardId}`);
});
client.on("error", (err) => {
  console.error(`gateway error name=${err instanceof Error ? err.name : "unknown"}`);
});

function shutdown(): void {
  client.destroy().finally(() => process.exit(0));
}
process.on("SIGTERM", shutdown);

await client.login(config.botToken);
