// Fixed model-facing text that base.ts sends and discord/leakguard.ts protects. It lives in a
// leaf module so the guard can read it without importing the responder (no import cycle).

// Frames the reference text for the model: plain description, no sample phrasings (L11).
export const KNOWLEDGE_FRAMING =
  "What follows is reference material about the game being asked about and its randomizer, for answering game questions when someone asks one. It is not a list of topics to bring up, and it is written for a bot, so do not copy its phrasing.";

export const OFFER_CHOICES_DESCRIPTION =
  "Ask the asker to pick when a name matches more than one thing. Ends the answer.";

export const PROPOSE_ACTION_DESCRIPTION =
  "Propose one write for the asker to confirm. Nothing runs until they press Confirm. Ends the answer.";
