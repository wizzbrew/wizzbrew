import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { UserInputError, userMessageFor } from "../errors.js";
import { type DmEntry, type DmLogView, readDmLog } from "../store/dmlog.js";
import { communityDate, communityHm, isYmd, parseWizzrobeTime } from "../time/time.js";
import type { ReplyTarget } from "../types.js";
import { deliver, deliverError } from "./deliver.js";

// /dmlog, the owner's view of the DM log. A direct command: no router, no model, no Wizzrobe.
// The caller has already checked the owner and the kill switch; this reads Redis and edits the
// deferred ephemeral reply.

// Discord allows 2000; the margin covers finalizeText and the trailer line.
const MESSAGE_MAX = 1900;
const USERS_MAX = 700;
const QUESTION_VIEW = 120;
const RESPONSE_VIEW = 120;
const NAME_VIEW = 40;
const RATE_LIMITED = "rate_limited";

// Names and text are user supplied. Backticks and angle brackets would break the layout or write
// a mention, and a line break would break the one-line-per-item shape.
function plain(text: string, max: number): string {
  const flat = text.replace(/[`<>]/g, "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

function nameOf(name: string | null): string {
  return plain(name ?? "", NAME_VIEW) || "unknown";
}

function entryLines(e: DmEntry): string {
  const head = `${communityHm(parseWizzrobeTime(e.ts))} ${nameOf(e.userName)}: ${plain(e.question, QUESTION_VIEW)}`;
  if (e.route === RATE_LIMITED) return `${head}\n> (refused, daily limit reached)`;
  return `${head}\n> ${plain(e.response, RESPONSE_VIEW) || "(no text)"}`;
}

// The whole message, under MESSAGE_MAX: a summary line, one line per person by count, then the
// latest entries newest first. The oldest entries are trimmed first, and the trim is counted.
export function renderDmLog(view: DmLogView): string {
  const { day, total, users, entries } = view;
  if (total === 0 && entries.length === 0) return `DM log for ${day}: no DMs.`;

  const people = users.length === 1 ? "person" : "people";
  const lines = [`DM log for ${day}: ${total} total from ${users.length} ${people}`];
  let used = lines[0]?.length ?? 0;
  let shownUsers = 0;
  for (const u of users) {
    const line = `${nameOf(u.userName)} (\`${u.userId}\`): ${u.count}`;
    if (used + line.length + 1 > USERS_MAX) break;
    lines.push(line);
    used += line.length + 1;
    shownUsers += 1;
  }
  if (shownUsers < users.length) lines.push(`...and ${users.length - shownUsers} more people`);

  if (entries.length > 0) {
    lines.push("", "Latest first:");
    let length = lines.join("\n").length;
    let shown = 0;
    for (const e of [...entries].reverse()) {
      const block = entryLines(e);
      // Room is kept for the trailer line that reports a trim.
      if (length + block.length + 1 > MESSAGE_MAX - 60) break;
      lines.push(block);
      length += block.length + 1;
      shown += 1;
    }
    const trimmed = entries.length - shown;
    if (trimmed > 0)
      lines.push(`(${trimmed} older ${trimmed === 1 ? "entry" : "entries"} trimmed)`);
  }
  return lines.join("\n");
}

type Options = { name: string; value?: unknown }[];

// The day option, default today on the community clock. Anything but a real YYYY-MM-DD is refused.
export function dmLogDay(i: APIChatInputApplicationCommandInteraction, now: Date): string {
  const found = ((i.data.options ?? []) as Options).find((o) => o.name === "day");
  const raw = typeof found?.value === "string" ? found.value.trim() : "";
  if (raw === "") return communityDate(now);
  if (!isYmd(raw)) throw new UserInputError("Give the day as YYYY-MM-DD, for example 2026-10-17.");
  return raw;
}

export async function runDmLogCommand(
  i: APIChatInputApplicationCommandInteraction,
  target: ReplyTarget,
  now: Date,
): Promise<void> {
  try {
    const view = await readDmLog(dmLogDay(i, now));
    await deliver(target, { text: renderDmLog(view), ephemeral: true }, {});
  } catch (err) {
    await deliverError(target, userMessageFor(err, { public: false }));
  }
}
