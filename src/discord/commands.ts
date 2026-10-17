import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

export type CommandName =
  | "ask"
  | "schedule"
  | "live"
  | "standings"
  | "player"
  | "link"
  | "unlink"
  | "me"
  | "help"
  | "dmlog";

// Commands only the bot's owner may run (OWNER_DISCORD_IDS). They are registered like any other,
// but /help does not list them and the dispatcher refuses everyone else before any lookup.
export const OWNER_COMMANDS: ReadonlySet<string> = new Set<CommandName>(["dmlog"]);

// Slash command definitions. Numeric literals stand in for the discord-api-types enums so this
// module has no runtime import from that package: type 1 is a chat input command, option type 3
// is a string, 6 a user, integration types 0 and 1 are guild and user installs, contexts 0, 1 and 2 are
// guild, bot DM and private channel.
const base: Pick<
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  "type" | "integration_types" | "contexts"
> = {
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

export const COMMANDS: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  {
    ...base,
    name: "ask",
    description: "Ask Wizzbrew a question about the event",
    options: [
      {
        type: 3,
        name: "question",
        description: "What you want to know",
        required: true,
        max_length: 500,
      },
    ],
  },
  {
    ...base,
    name: "schedule",
    description: "See what is scheduled",
    options: [
      {
        type: 3,
        name: "day",
        description: "Today, tomorrow, a weekday or a date",
        required: false,
      },
      { type: 3, name: "stage", description: "Limit the schedule to one stage", required: false },
      {
        type: 3,
        name: "tournament",
        description: "Limit the schedule to one tournament",
        required: false,
      },
    ],
  },
  {
    ...base,
    name: "live",
    description: "See what is on stream right now",
  },
  {
    ...base,
    name: "standings",
    description: "See the standings for a tournament",
    options: [{ type: 3, name: "tournament", description: "Which tournament", required: true }],
  },
  {
    ...base,
    name: "player",
    description: "Look up a player",
    options: [
      { type: 3, name: "name", description: "The player's name", required: false },
      { type: 6, name: "user", description: "A Discord user", required: false },
    ],
  },
  {
    ...base,
    name: "link",
    description: "Connect your Wizzrobe account",
  },
  {
    ...base,
    name: "unlink",
    description: "Disconnect your Wizzrobe account",
  },
  {
    ...base,
    name: "me",
    description: "See your own matches and crew shifts",
  },
  {
    ...base,
    name: "help",
    description: "What Wizzbrew can do and how to ask",
  },
  {
    ...base,
    name: "dmlog",
    description: "Owner only: who sent DMs, and what was asked",
    options: [
      {
        type: 3,
        name: "day",
        description: "Which day to show, year then month then day; default today",
        required: false,
        max_length: 10,
      },
    ],
  },
];
