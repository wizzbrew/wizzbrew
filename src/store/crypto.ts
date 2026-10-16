import { NotImplemented } from "../errors.js";

export async function seal(_plaintext: string): Promise<string> {
  throw new NotImplemented("crypto.seal");
}

export async function open(_sealed: string): Promise<string> {
  throw new NotImplemented("crypto.open");
}
