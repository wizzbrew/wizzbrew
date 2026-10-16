import { NotImplemented } from "../errors.js";

export type ComponentAction =
  | { kind: "confirm"; pendingId: string }
  | { kind: "cancel"; pendingId: string }
  | { kind: "choose"; threadId: string; value: string };

export function encodeCustomId(_a: ComponentAction): string {
  throw new NotImplemented("components.encodeCustomId");
}

export function decodeCustomId(_id: string): ComponentAction | null {
  throw new NotImplemented("components.decodeCustomId");
}
