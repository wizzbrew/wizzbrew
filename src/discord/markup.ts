import type { APIInteractionDataResolved } from "discord-api-types/v10";

type Resolved = APIInteractionDataResolved;

const LIMIT = 2000;
const FENCE = "```";
const CLOSE_TAIL = "\n```";
// A longer code fence info string is dropped, so reopening a fence always makes progress.
const MAX_LANG = 32;

// Raw Discord markup: <@id>, <@!id>, <@&id>, <#id>, <t:epoch[:style]>, <:name:id>, <a:name:id>.
const MARKUP =
  /<(?:(?<mention>@!?|@&|#)(?<id>\d+)|a?:(?<emoji>[^:<>\s]+):\d+|t:(?<epoch>-?\d+)(?::[tTdDfFR])?)>/g;
const TIMESTAMP = /<t:-?\d+(?::[tTdDfFR])?>/g;
const ROLE_LINE = /^( *)((?:human|assistant|system):)/i;
const EN_DASH_BETWEEN_DIGITS = /(?<=\d)\u2013(?=\d)/g;
const DASH_WITH_SPACES = / *[\u2014\u2013] */g;

// Cut preference, best first. The sentence marks share one level and keep their punctuation.
const BREAKS: readonly (readonly { sep: string; keep: number }[])[] = [
  [{ sep: "\n\n", keep: 0 }],
  [{ sep: "\n", keep: 0 }],
  [
    { sep: ". ", keep: 1 },
    { sep: "! ", keep: 1 },
    { sep: "? ", keep: 1 },
  ],
  [{ sep: " ", keep: 0 }],
];

interface Span {
  start: number;
  end: number;
}

interface FenceBlock extends Span {
  contentStart: number;
  closeStart: number;
  lang: string;
}

interface Cut {
  end: number;
  next: number;
}

type CutCheck = (end: number, next: number) => boolean;

/** Turns raw Discord markup in user text into readable text. Unknown ids never throw. */
export function normalizeInput(text: string, resolved?: Resolved): string {
  return text.replace(MARKUP, (token: string, ...args: unknown[]) => {
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    if (groups.mention !== undefined) {
      return resolveMention(groups.mention, groups.id ?? "", resolved);
    }
    if (groups.emoji !== undefined) {
      return `:${groups.emoji}:`;
    }
    return formatEpoch(groups.epoch ?? "") ?? token;
  });
}

/** Makes user text safe to put in a prompt: no control characters, no fake role lines. */
export function sanitizeForPrompt(text: string, maxLen = 500): string {
  let kept = "";
  for (const ch of text) {
    if (!isControl(ch.charCodeAt(0), ch)) {
      kept += ch;
    }
  }
  const cleaned = kept
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/<\//g, "< /")
    .split("\n")
    .map((line) => line.replace(ROLE_LINE, "$1(quoted) $2"))
    .join("\n");
  return truncate(cleaned, maxLen);
}

/** Makes bot output Discord-ready: no em or en dashes, chunks of at most 2000 characters. */
export function finalizeText(text: string): string[] {
  let rest = cleanDashes(text).trim();
  const chunks: string[] = [];
  while (rest.length > LIMIT) {
    const split = takeChunk(rest);
    chunks.push(split.chunk.trim());
    rest = split.rest;
  }
  chunks.push(rest);
  const kept = chunks.filter((chunk) => chunk.length > 0);
  return kept.length > 0 ? kept : [""];
}

function resolveMention(kind: string, id: string, resolved: Resolved | undefined): string {
  if (kind === "@&") {
    return `@${nonEmpty(resolved?.roles?.[id]?.name) ?? "unknown"}`;
  }
  if (kind === "#") {
    return `#${nonEmpty(resolved?.channels?.[id]?.name) ?? "unknown"}`;
  }
  const name =
    nonEmpty(resolved?.members?.[id]?.nick) ??
    nonEmpty(resolved?.users?.[id]?.global_name) ??
    nonEmpty(resolved?.users?.[id]?.username) ??
    "unknown";
  return `@${name}`;
}

function nonEmpty(value: string | null | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

function formatEpoch(epoch: string): string | undefined {
  const date = new Date(Number(epoch) * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isControl(code: number, ch: string): boolean {
  const lowControl = code < 0x20 && ch !== "\n" && ch !== "\t";
  const c1Control = code >= 0x7f && code <= 0x9f;
  return lowControl || c1Control;
}

function truncate(text: string, maxLen: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLen) {
    return text;
  }
  if (maxLen <= 3) {
    return chars.slice(0, Math.max(0, maxLen)).join("");
  }
  return `${chars.slice(0, maxLen - 3).join("")}...`;
}

function cleanDashes(text: string): string {
  return text
    .replace(EN_DASH_BETWEEN_DIGITS, "-")
    .replace(DASH_WITH_SPACES, ", ")
    .replace(/, ,/g, ",")
    .replace(/ ,/g, ",")
    .replace(/,\./g, ".");
}

/** Takes the first chunk off the text. Returns the chunk and the text left after it. */
function takeChunk(text: string): { chunk: string; rest: string } {
  const blocks = fenceBlocks(text);
  const { end, next } = findCut(text, blocks, timestampSpans(text));
  const open = blocks.find((block) => block.start < end && end < block.end);
  if (open === undefined) {
    return { chunk: text.slice(0, end), rest: text.slice(next).trimStart() };
  }
  // An oversized code block is cut: close it in this chunk and reopen it in the rest.
  return {
    chunk: `${text.slice(0, end).trimEnd()}${CLOSE_TAIL}`,
    rest: `${FENCE}${open.lang}\n${text.slice(next).trimStart()}`,
  };
}

function findCut(text: string, blocks: FenceBlock[], timestamps: Span[]): Cut {
  const allowed: CutCheck = (end, next) => cutAllowed(end, next, blocks, timestamps);
  for (const level of BREAKS) {
    let best: Cut | undefined;
    for (const { sep, keep } of level) {
      const cut = lastCut(text, sep, keep, allowed);
      if (cut && (best === undefined || cut.end > best.end)) {
        best = cut;
      }
    }
    if (best !== undefined) {
      return best;
    }
  }
  // No preferred break: hard cut at the last position that is still legal.
  for (let end = LIMIT; end > 0; end--) {
    if (allowed(end, end)) {
      return { end, next: end };
    }
  }
  return { end: LIMIT - CLOSE_TAIL.length, next: LIMIT - CLOSE_TAIL.length };
}

function lastCut(text: string, sep: string, keep: number, allowed: CutCheck): Cut | undefined {
  let at = text.lastIndexOf(sep, LIMIT - keep);
  while (at > 0) {
    const cut = { end: at + keep, next: at + sep.length };
    if (allowed(cut.end, cut.next)) {
      return cut;
    }
    at = text.lastIndexOf(sep, at - 1);
  }
  return undefined;
}

function cutAllowed(end: number, next: number, blocks: FenceBlock[], timestamps: Span[]): boolean {
  if (timestamps.some((span) => span.start < end && end < span.end)) {
    return false;
  }
  const block = blocks.find((b) => b.start < end && end < b.end);
  if (block === undefined) {
    return true;
  }
  // A block that fits in one chunk stays whole. An oversized one may be cut inside its body,
  // leaving room for the closing fence.
  if (block.end - block.start <= LIMIT) {
    return false;
  }
  return end > block.contentStart && next < block.closeStart && end <= LIMIT - CLOSE_TAIL.length;
}

function fenceBlocks(text: string): FenceBlock[] {
  const blocks: FenceBlock[] = [];
  let start = text.indexOf(FENCE);
  while (start !== -1) {
    const newline = text.indexOf("\n", start + FENCE.length);
    const infoEnd = newline === -1 ? text.length : newline;
    const info = text.slice(start + FENCE.length, infoEnd).trim();
    const contentStart = newline === -1 ? text.length : newline + 1;
    const closeAt = text.indexOf(FENCE, contentStart);
    const end = closeAt === -1 ? text.length : closeAt + FENCE.length;
    blocks.push({
      start,
      end,
      contentStart,
      closeStart: closeAt === -1 ? text.length : closeAt,
      lang: info.length <= MAX_LANG ? info : "",
    });
    start = closeAt === -1 ? -1 : text.indexOf(FENCE, end);
  }
  return blocks;
}

function timestampSpans(text: string): Span[] {
  return Array.from(text.matchAll(TIMESTAMP), (match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length };
  });
}
