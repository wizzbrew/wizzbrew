export const MODELS: {
  router: "claude-haiku-5-5";
  responder: "claude-sonnet-5-5";
  chat: "claude-haiku-5-5";
} = {
  router: "claude-haiku-5-5",
  responder: "claude-sonnet-5-5",
  chat: "claude-haiku-5-5",
};

// USD per million tokens. Anthropic first-party rates, checked 2026-10-15.
// Cache write is the 5-minute TTL (1.25x input). Haiku's rates apply to prompts up to
// 100K tokens, which covers every Wizzbrew prompt.
export const PRICING: Record<
  string,
  { inPerM: number; outPerM: number; cacheReadPerM: number; cacheWritePerM: number }
> = {
  "claude-haiku-5-5": { inPerM: 0.1, outPerM: 0.5, cacheReadPerM: 0.01, cacheWritePerM: 0.125 },
  "claude-sonnet-5-5": { inPerM: 2, outPerM: 10, cacheReadPerM: 0.2, cacheWritePerM: 2.5 },
};

// Fail at startup if a routed model has no price (L12: a new model must never
// be billed at an old model's rate).
for (const model of Object.values(MODELS)) {
  if (PRICING[model] === undefined) {
    throw new Error(`no pricing for ${model}`);
  }
}
