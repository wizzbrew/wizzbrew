import { NotImplemented } from "../../src/errors.js";

// Routes by URL prefix; an unknown URL throws.
export function combineFetch(..._routes: { prefix: string; fetch: typeof fetch }[]): typeof fetch {
  throw new NotImplemented("combineFetch");
}
