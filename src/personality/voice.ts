import { NotImplemented } from "../errors.js";

export type Register = "data" | "help" | "chat";

export function voice(_register: Register): string {
  throw new NotImplemented("voice.voice");
}
