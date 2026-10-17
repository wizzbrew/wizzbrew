import { COMMANDS, OWNER_COMMANDS } from "./commands.js";

// The /help overview. The command list is built from COMMANDS so it cannot drift from what is
// registered, minus /help itself and the owner-only commands; the paragraphs after it are fixed
// text. Pure: no I/O, no model call.
export function helpText(): string {
  const commands = COMMANDS.filter((c) => c.name !== "help" && !OWNER_COMMANDS.has(c.name))
    .map((c) => `- **/${c.name}**: ${c.description}`)
    .join("\n");
  return [
    "Wizzbrew answers questions about the event from Wizzrobe: the schedule, streams, standings, players and how things work.",
    `Slash commands:\n${commands}`,
    "You can also @mention me in a channel I am allowed in and ask in plain words. Reply to one of my messages to follow up.",
    "**/link** connects your Wizzrobe account. Then **/me** works, and I can sign you up as crew, acknowledge a match or offer one for stream, after you press Confirm.",
    "Personal answers are visible only to the person who asked.",
    "I only read messages that mention me or reply to me.",
  ].join("\n\n");
}
