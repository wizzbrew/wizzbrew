import { CHAT_BLOCK, CORE, DATA_BLOCK, HELP_BLOCK } from "../personality/voice.js";
import { clientToolDefs } from "../responders/clientTools.js";
import {
  KNOWLEDGE_FRAMING,
  OFFER_CHOICES_DESCRIPTION,
  PROPOSE_ACTION_DESCRIPTION,
} from "../responders/fixedtext.js";
import { SHARED_RULES } from "../responders/specs.js";
import { ROUTER_PROMPT } from "../router/prompt.js";
import { ROUTES } from "../router/routes.js";

// Last line of defense on the talking side: the prompt text is stable, so a verbatim run of it in
// an answer means someone got the model to recite its instructions. Pure and synchronous. The
// prompts say not to disclose; this is the check that does not depend on the model obeying.

const WINDOW = 60;
const STRIDE = 20;

// What the bot says in place of an answer that quoted its own setup. Plain, no dashes.
export const LEAK_REFUSAL = "I can't share how I'm set up. Can I get you a glass of water?";

// Lowercase and collapse whitespace; punctuation stays so a quote still lines up character by
// character with the source.
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function mostlyPunctuation(window: string): boolean {
  const punct = window.replace(/[\p{L}\p{N}\s]/gu, "").length;
  return punct * 2 > window.length;
}

// Every 60 character window at a stride of 20, so any verbatim run of 79 characters or more
// contains at least one. Shorter texts and windows that are mostly punctuation are skipped.
export function leakWindows(protectedTexts: readonly string[]): string[] {
  const windows = new Set<string>();
  for (const text of protectedTexts) {
    const norm = normalize(text);
    for (let at = 0; at + WINDOW <= norm.length; at += STRIDE) {
      const window = norm.slice(at, at + WINDOW);
      if (!mostlyPunctuation(window)) windows.add(window);
    }
  }
  return [...windows];
}

// Checking every window with includes costs about a millisecond for a full length answer. A
// rolling hash over the answer finds candidate positions in one pass, and startsWith confirms
// each one, so a hash collision can never report a leak that is not there.
const BASE = 31;

function hashAt(text: string, start: number): number {
  let h = 0;
  for (let i = 0; i < WINDOW; i++) h = (Math.imul(h, BASE) + text.charCodeAt(start + i)) | 0;
  return h;
}

// BASE to the power WINDOW - 1, the weight of the character that leaves the window.
const OUT_WEIGHT = (() => {
  let w = 1;
  for (let i = 1; i < WINDOW; i++) w = Math.imul(w, BASE);
  return w;
})();

export function buildLeakGuard(protectedTexts: readonly string[]): (answer: string) => boolean {
  const byHash = new Map<number, string[]>();
  for (const window of leakWindows(protectedTexts)) {
    const h = hashAt(window, 0);
    const bucket = byHash.get(h);
    if (bucket) bucket.push(window);
    else byHash.set(h, [window]);
  }
  return (answer) => {
    if (byHash.size === 0 || answer.length < WINDOW) return false;
    const norm = normalize(answer);
    const last = norm.length - WINDOW;
    if (last < 0) return false;
    let h = hashAt(norm, 0);
    for (let at = 0; ; at++) {
      const bucket = byHash.get(h);
      if (bucket?.some((window) => norm.startsWith(window, at))) return true;
      if (at === last) return false;
      const out = Math.imul(norm.charCodeAt(at), OUT_WEIGHT);
      h = (Math.imul((h - out) | 0, BASE) + norm.charCodeAt(at + WINDOW)) | 0;
    }
  };
}

const clientTools = [...new Set(Object.values(ROUTES).flatMap((r) => r.clientTools))];

// Left out on purpose: ALTTP_KNOWLEDGE, because public game facts are fine to quote, and the
// route specs' instructions, because they carry public facts (stage channels, help pages) that a
// correct answer may repeat verbatim; a false refusal costs more than an uncaught job
// description. The per-request context block (tenant, ids, link status) varies, so it cannot be
// matched here; the Not disclosed rule covers it.
export const PROTECTED_TEXTS: readonly string[] = [
  CORE,
  DATA_BLOCK,
  HELP_BLOCK,
  CHAT_BLOCK,
  SHARED_RULES,
  ROUTER_PROMPT,
  KNOWLEDGE_FRAMING,
  OFFER_CHOICES_DESCRIPTION,
  PROPOSE_ACTION_DESCRIPTION,
  ...clientToolDefs(clientTools).flatMap((t) => (t.description ? [t.description] : [])),
];

export const isPromptLeak: (answer: string) => boolean = buildLeakGuard(PROTECTED_TEXTS);
