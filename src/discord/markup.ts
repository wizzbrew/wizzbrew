import type { APIInteractionDataResolved } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";

export function normalizeInput(_text: string, _resolved?: APIInteractionDataResolved): string {
  throw new NotImplemented("markup.normalizeInput");
}

export function sanitizeForPrompt(_text: string, _maxLen?: number): string {
  throw new NotImplemented("markup.sanitizeForPrompt");
}

export function finalizeText(_text: string): string[] {
  throw new NotImplemented("markup.finalizeText");
}
