import { z } from "zod";

const schema = z.object({
  RELAY_SECRET: z.string().min(32),
  DISCORD_BOT_TOKEN: z.string().min(1),
  WIZZBREW_URL: z.url().refine((u) => u.startsWith("https://"), "must be https"),
  RELAY_CHANNEL_IDS: z.string().default(""),
});

export interface RelayConfig {
  secret: string;
  botToken: string;
  baseUrl: string;
  channelIds: Set<string>;
}

export function loadConfig(): RelayConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Invalid relay config, check: ${names.join(", ")}`);
  }
  const env = parsed.data;
  return {
    secret: env.RELAY_SECRET,
    botToken: env.DISCORD_BOT_TOKEN,
    baseUrl: env.WIZZBREW_URL.replace(/\/+$/, ""),
    channelIds: new Set(
      env.RELAY_CHANNEL_IDS.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  };
}
