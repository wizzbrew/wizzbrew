import type { APIEmbed } from "discord-api-types/v10";

export type Route =
  | "schedule"
  | "streams"
  | "standings"
  | "players"
  | "tournaments"
  | "my_stuff"
  | "crew"
  | "player_actions"
  | "help"
  | "staff"
  | "chat";

export type AuthLevel = "public" | "linked" | "staff";

export interface RoutingDecision {
  route: Route;
  confidence: number; // 0..1
  params: {
    day?: string; // YYYY-MM-DD in community tz, resolved in code from text
    tournament?: string; // raw name as said; resolved later (L18)
    player?: string;
    stage?: string;
    matchId?: number;
  };
  reason: string; // one short line, logged (L24)
}

export interface Asker {
  discordUserId: string;
  discordName: string;
  guildId: string | null;
  channelId: string;
  linked: LinkedAccount | null; // filled by identity.ts (L7, L19)
}

export interface LinkedAccount {
  wizzrobeUserId: number;
  wizzrobeUsername: string;
  roles: string[]; // from whoami/get_user, cached
  canWrite: boolean;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AskContext {
  requestId: string;
  asker: Asker;
  question: string; // already normalizeInput()'d
  now: Date;
  ephemeral: boolean;
  history: ConversationTurn[]; // earlier turns of this thread, oldest first (empty for a new question)
}

export interface Answer {
  text: string; // markdown, finalizeText() applied at render
  embeds?: DiscordEmbed[];
  proposedAction?: ProposedAction; // write routes only; rendered as Confirm/Cancel
  choices?: { label: string; value: string }[]; // disambiguation buttons (L18)
  ephemeral: boolean;
}

export interface ProposedAction {
  tool: WriteTool; // allowlisted write tool name
  args: Record<string, unknown>; // validated against the tool's zod schema
  summary: string; // what the user is confirming, plain words, with <t:> times
}

export type WriteTool =
  | "signup_as_crew"
  | "withdraw_crew_signup"
  | "acknowledge_match"
  | "offer_match_for_stream"
  | "withdraw_stream_offer"
  | "watch_match"
  | "unwatch_match"
  | "sign_up_for_tournament"
  | "withdraw_from_tournament"
  | "submit_match_request"
  | "rest_create_reschedule_request"
  | "rest_book_bracket_game";

export interface PendingAction extends ProposedAction {
  id: string;
  discordUserId: string; // only this user may confirm
  createdAt: number;
  expiresAt: number; // sliding (L15)
}

export type ResolveResult<T> =
  | { kind: "match"; value: T }
  | { kind: "ambiguous"; options: T[] }
  | { kind: "none" };

export type DiscordEmbed = APIEmbed;

export interface LinkRecord {
  // stored at keys.link(discordUserId) as JSON
  sealedRefreshToken: string; // seal()ed; never logged
  wizzrobeUserId: number;
  username: string;
  roles: string[];
  canWrite: boolean;
  linkedAt: number; // epoch ms
  rolesCheckedAt: number; // epoch ms; roles refresh at most every 10 minutes
}

export interface ThreadRecord {
  // conversation and disambiguation context, keys.thread(id), 30-minute sliding TTL (L15)
  id: string;
  discordUserId: string; // only this user may pick a choice
  question: string; // the normalized question that produced the choices
  decision: RoutingDecision;
  ephemeral: boolean;
  turns: ConversationTurn[]; // last 6 turns, oldest first, each text capped at 1500 chars
  createdAt: number;
  expiresAt: number;
}
