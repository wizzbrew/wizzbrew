export const MODELS: {
  router: "claude-haiku-5-5";
  responder: "claude-sonnet-5-5";
  chat: "claude-haiku-5-5";
} = {
  router: "claude-haiku-5-5",
  responder: "claude-sonnet-5-5",
  chat: "claude-haiku-5-5",
};

// Filled in by the budget task (L12). Empty until then.
export const PRICING: Record<
  string,
  { inPerM: number; outPerM: number; cacheReadPerM: number; cacheWritePerM: number }
> = {};
