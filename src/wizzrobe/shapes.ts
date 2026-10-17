import { z } from "zod";

// Wizzrobe's list tools return a bare JSON array. FastMCP wraps it as {"result": [...]} on the
// wire and callTool unwraps that, but a wrapped list is still accepted so an unwrapped path
// cannot turn into a ZodError.
export function listOf<T extends z.ZodTypeAny>(item: T) {
  return z.union([
    z.array(item),
    z.object({ result: z.array(item) }).transform((wrapped) => wrapped.result),
  ]);
}
