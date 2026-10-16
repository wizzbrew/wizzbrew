export type ComponentAction =
  | { kind: "confirm"; pendingId: string }
  | { kind: "cancel"; pendingId: string }
  | { kind: "choose"; threadId: string; value: string }
  | { kind: "followup"; threadId: string };

// Discord caps custom_id at 100 characters. Ids are short ASCII tokens with no
// ":", so the "wb:<kind>:" prefix splits unambiguously. A choose value is
// everything after the third colon and may contain colons itself.
const MAX_CUSTOM_ID_LENGTH = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const PENDING_PATTERN = /^wb:(confirm|cancel):([A-Za-z0-9_-]{1,40})$/;
const FOLLOWUP_PATTERN = /^wb:followup:([A-Za-z0-9_-]{1,40})$/;
const CHOOSE_PATTERN = /^wb:choose:([A-Za-z0-9_-]{1,40}):([\s\S]+)$/;

function assertId(id: string, label: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`components: ${label} is not a valid id`);
  }
}

export function encodeCustomId(a: ComponentAction): string {
  let id: string;
  if (a.kind === "choose") {
    assertId(a.threadId, "threadId");
    if (a.value.length === 0) {
      throw new Error("components: choose value is empty");
    }
    id = `wb:choose:${a.threadId}:${a.value}`;
  } else if (a.kind === "followup") {
    assertId(a.threadId, "threadId");
    id = `wb:followup:${a.threadId}`;
  } else {
    assertId(a.pendingId, "pendingId");
    id = `wb:${a.kind}:${a.pendingId}`;
  }
  if (id.length > MAX_CUSTOM_ID_LENGTH) {
    throw new Error(
      `components: custom id is ${id.length} characters, the limit is ${MAX_CUSTOM_ID_LENGTH}`,
    );
  }
  return id;
}

export function decodeCustomId(id: string): ComponentAction | null {
  if (typeof id !== "string" || id.length > MAX_CUSTOM_ID_LENGTH) {
    return null;
  }
  const pending = PENDING_PATTERN.exec(id);
  if (pending) {
    const pendingId = pending[2] ?? "";
    return pending[1] === "confirm"
      ? { kind: "confirm", pendingId }
      : { kind: "cancel", pendingId };
  }
  const choose = CHOOSE_PATTERN.exec(id);
  if (choose) {
    return {
      kind: "choose",
      threadId: choose[1] ?? "",
      value: choose[2] ?? "",
    };
  }
  const followup = FOLLOWUP_PATTERN.exec(id);
  if (followup) {
    return { kind: "followup", threadId: followup[1] ?? "" };
  }
  return null;
}
