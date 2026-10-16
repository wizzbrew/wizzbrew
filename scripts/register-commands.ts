import { configFor } from "../src/config.js";
import { discordApi } from "../src/discord/api.js";
import { COMMANDS } from "../src/discord/commands.js";

// PUT slash commands: guild-scoped when DISCORD_DEV_GUILD_ID is set, global otherwise.
// Prints a count and a target, never a token.
try {
  const guildId = configFor("discordDevGuildId").discordDevGuildId ?? undefined;
  await discordApi().registerCommands(COMMANDS, guildId);
  const target = guildId === undefined ? "global" : `guild ${guildId}`;
  console.log(`Registered ${COMMANDS.length} commands to ${target}.`);
} catch (err) {
  const message = err instanceof Error ? err.message : "unknown error";
  console.error(`Command registration failed: ${message}`);
  process.exitCode = 1;
}
