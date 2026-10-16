export class NotImplemented extends Error {}

export class WizzrobeError extends Error {
  // 401 expired link, 403 forbidden, 404 not found/feature off, 429, 5xx
  constructor(
    public status: number,
    public detail: string,
    public retryAfterSec?: number,
  ) {
    super(detail);
  }
}

export class NotLinkedError extends Error {}

export class BudgetExceededError extends Error {}

export class ModelOutputError extends Error {
  // refusal, max_tokens, schema failure (L10)
  constructor(
    public stopReason: string,
    message: string,
  ) {
    super(message);
  }
}

export class UserInputError extends Error {} // e.g. unparseable time (L3); message is shown to the user

export class DiscordError extends Error {
  // Discord REST failure; 403 names the missing permission (L17)
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// The one place errors become replies (L16, L17). No em dashes, no raw status codes.
export function userMessageFor(err: unknown): string {
  if (err instanceof UserInputError) return err.message;
  if (err instanceof NotLinkedError) {
    return err.message !== "" ? err.message : "Run /link first to connect your Wizzrobe account.";
  }
  if (err instanceof BudgetExceededError)
    return "I've hit today's usage limit. Try again tomorrow.";
  if (err instanceof WizzrobeError) {
    if (err.status === 429) return "Wizzrobe is busy, try again in a minute.";
    if (err.status === 401) return "Your Wizzrobe link expired. Run /link to connect again.";
    if (err.status === 403) return `Your Wizzrobe account can't do that (${err.detail}).`;
    if (err.status === 404) {
      return err.detail.includes("not enabled")
        ? "That feature is not turned on for this event."
        : "Wizzrobe couldn't find that.";
    }
    if (err.status === 400) return `Wizzrobe turned that down: ${err.detail}`;
    return "Wizzrobe is having trouble right now. Try again in a minute.";
  }
  if (err instanceof ModelOutputError) {
    return "I couldn't put an answer together for that. Try asking another way.";
  }
  if (err instanceof DiscordError) return `I couldn't post that in Discord (${err.message}).`;
  return "Something went wrong on my side. Try again in a minute.";
}
