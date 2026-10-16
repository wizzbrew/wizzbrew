// The URL a fetch() call was given, whatever form the input took.
export function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

// Routes by URL prefix; an unknown URL throws.
export function combineFetch(...routes: { prefix: string; fetch: typeof fetch }[]): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    const route = routes.find((r) => url.startsWith(r.prefix));
    if (!route) throw new Error(`no fake for ${url}`);
    return route.fetch(input, init);
  };
}
