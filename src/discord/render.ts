import type {
  APIActionRowComponent,
  APIButtonComponent,
  RESTPatchAPIInteractionOriginalResponseJSONBody,
} from "discord-api-types/v10";
import type { Answer } from "../types.js";
import { encodeCustomId } from "./components.js";
import { finalizeText } from "./markup.js";

// Discord numeric values, written as literals so nothing is imported at runtime.
// Component types: action row 1, button 2. Button styles: secondary 2, success 3,
// danger 4. Message flags: ephemeral 64.
const MAX_CUSTOM_ID_LENGTH = 100;
const MAX_CHOICE_BUTTONS = 5;
const MAX_LABEL_LENGTH = 80;
const CHOOSE_PREFIX_LENGTH = "wb:choose:".length;
const FLAG_EPHEMERAL = 64;

type Choices = NonNullable<Answer["choices"]>;

function confirmRow(pendingId: string): APIActionRowComponent<APIButtonComponent> {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 3,
        label: "Confirm",
        custom_id: encodeCustomId({ kind: "confirm", pendingId }),
      },
      {
        type: 2,
        style: 4,
        label: "Cancel",
        custom_id: encodeCustomId({ kind: "cancel", pendingId }),
      },
    ],
  };
}

function choiceRow(
  threadId: string,
  choices: Choices,
): APIActionRowComponent<APIButtonComponent> | null {
  const buttons: APIButtonComponent[] = [];
  for (const choice of choices) {
    if (buttons.length === MAX_CHOICE_BUTTONS) {
      break;
    }
    // Skip a choice whose custom id would not fit. encodeCustomId still
    // validates threadId and the value, so bad input fails loud.
    const idLength = CHOOSE_PREFIX_LENGTH + threadId.length + 1 + choice.value.length;
    if (idLength > MAX_CUSTOM_ID_LENGTH) {
      continue;
    }
    buttons.push({
      type: 2,
      style: 2,
      label: choice.label.slice(0, MAX_LABEL_LENGTH),
      custom_id: encodeCustomId({ kind: "choose", threadId, value: choice.value }),
    });
  }
  return buttons.length > 0 ? { type: 1, components: buttons } : null;
}

function followupRow(threadId: string): APIActionRowComponent<APIButtonComponent> {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: "Ask a follow-up",
        custom_id: encodeCustomId({ kind: "followup", threadId }),
      },
    ],
  };
}

function buildComponents(
  a: Answer,
  ids?: { pendingId?: string; threadId?: string },
): APIActionRowComponent<APIButtonComponent>[] {
  const rows: APIActionRowComponent<APIButtonComponent>[] = [];
  if (ids?.pendingId) {
    rows.push(confirmRow(ids.pendingId));
    return rows;
  }
  if (ids?.threadId) {
    if (a.choices) {
      const row = choiceRow(ids.threadId, a.choices);
      if (row) {
        rows.push(row);
        return rows;
      }
    }
    rows.push(followupRow(ids.threadId));
  }
  return rows;
}

export function renderAnswer(
  a: Answer,
  ids?: { pendingId?: string; threadId?: string },
): RESTPatchAPIInteractionOriginalResponseJSONBody[] {
  const chunks = finalizeText(a.text);
  if (chunks.length === 0) {
    throw new Error("render.renderAnswer: finalizeText returned no chunks");
  }
  const components = buildComponents(a, ids);
  return chunks.map((content, index): RESTPatchAPIInteractionOriginalResponseJSONBody => {
    if (index === 0) {
      // Edits the deferred reply, whose visibility was set at deferral.
      return {
        content,
        embeds: a.embeds ?? [],
        components,
        allowed_mentions: { parse: [] },
      };
    }
    // Followups set visibility per message, so each one carries the flag.
    return a.ephemeral
      ? { content, allowed_mentions: { parse: [] }, flags: FLAG_EPHEMERAL }
      : { content, allowed_mentions: { parse: [] } };
  });
}

export function renderError(
  message: string,
  _ephemeral: boolean,
): RESTPatchAPIInteractionOriginalResponseJSONBody {
  // The deferral already set visibility, so ephemeral is accepted for symmetry only.
  const [content] = finalizeText(message);
  if (content === undefined) {
    throw new Error("render.renderError: message has no text");
  }
  return {
    content,
    embeds: [],
    components: [],
    allowed_mentions: { parse: [] },
  };
}
