import type { ResolveResult } from "../types.js";

type Keyed<T> = { item: T; exact: string; alias: string };

// Unicode NFD, drop combining marks, lowercase, collapse whitespace, trim.
function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// norm, drop a leading "the ", then turn every non letter, non digit into a space.
function alias(s: string): string {
  let n = norm(s);
  if (n.startsWith("the ")) {
    n = n.slice(4);
  }
  return n
    .replace(/[^\p{L}\p{Nd} ]/gu, " ")
    .replace(/ +/g, " ")
    .trim();
}

// Several hits are ambiguous (all of them, in input order); one hit is a match.
function decide<T>(hits: Keyed<T>[]): ResolveResult<T> | undefined {
  const [first] = hits;
  if (first === undefined) {
    return undefined;
  }
  if (hits.length === 1) {
    return { kind: "match", value: first.item };
  }
  return { kind: "ambiguous", options: hits.map((h) => h.item) };
}

// Never guesses: the first step with any hit decides, and nothing is scored.
export function resolveByName<T>(
  input: string,
  items: T[],
  nameOf: (t: T) => string,
): ResolveResult<T> {
  const query = norm(input);
  if (query === "") {
    return { kind: "none" };
  }

  const keyed: Keyed<T>[] = items.map((item) => {
    const name = nameOf(item);
    return { item, exact: norm(name), alias: alias(name) };
  });

  const exact = decide(keyed.filter((k) => k.exact === query));
  if (exact) {
    return exact;
  }

  const queryAlias = alias(input);
  // Punctuation-only input has no alias to match on, so it must not match a punctuation-only name.
  if (queryAlias === "") {
    return { kind: "none" };
  }

  const sameAlias = decide(keyed.filter((k) => k.alias === queryAlias));
  if (sameAlias) {
    return sameAlias;
  }

  // Equal aliases were handled above, so only the "followed by a space" case is left.
  const wordPrefix = decide(keyed.filter((k) => k.alias.startsWith(`${queryAlias} `)));
  if (wordPrefix) {
    return wordPrefix;
  }

  return { kind: "none" };
}
