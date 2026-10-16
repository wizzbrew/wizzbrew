import type { RESTPatchAPIInteractionOriginalResponseJSONBody } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";
import type { Answer } from "../types.js";

export function renderAnswer(
  _a: Answer,
  _ids?: { pendingId?: string; threadId?: string },
): RESTPatchAPIInteractionOriginalResponseJSONBody[] {
  throw new NotImplemented("render.renderAnswer");
}

export function renderError(
  _message: string,
  _ephemeral: boolean,
): RESTPatchAPIInteractionOriginalResponseJSONBody {
  throw new NotImplemented("render.renderError");
}
