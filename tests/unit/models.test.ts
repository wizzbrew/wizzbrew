import { describe, expect, it } from "vitest";
import { MODELS, PRICING } from "../../src/llm/models.js";

describe("MODELS pricing", () => {
  it.each(Object.entries(MODELS))(
    "%s has a price with all four rates above zero",
    (_role, model) => {
      const price = PRICING[model];
      expect(price).toBeDefined();
      expect(price?.inPerM).toBeGreaterThan(0);
      expect(price?.outPerM).toBeGreaterThan(0);
      expect(price?.cacheReadPerM).toBeGreaterThan(0);
      expect(price?.cacheWritePerM).toBeGreaterThan(0);
    },
  );
});
