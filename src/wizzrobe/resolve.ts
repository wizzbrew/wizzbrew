import { NotImplemented } from "../errors.js";
import type { ResolveResult } from "../types.js";

export function resolveByName<T>(
  _input: string,
  _items: T[],
  _nameOf: (t: T) => string,
): ResolveResult<T> {
  throw new NotImplemented("resolve.resolveByName");
}
