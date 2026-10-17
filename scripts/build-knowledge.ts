// Turns prompts/alttp-game-knowledge.md into src/personality/knowledge.ts, a TS constant the chat
// prompt imports. Vercel's bundler cannot be trusted to ship a loose markdown file, so the text
// travels as code. Run with: npx tsx scripts/build-knowledge.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const KNOWLEDGE_MD = fileURLToPath(
  new URL("../prompts/alttp-game-knowledge.md", import.meta.url),
);
export const KNOWLEDGE_TS = fileURLToPath(
  new URL("../src/personality/knowledge.ts", import.meta.url),
);

const HEADER =
  "// Generated from prompts/alttp-game-knowledge.md by scripts/build-knowledge.ts. Do not edit; edit the markdown and rerun.";

// The exact text of src/personality/knowledge.ts for a given markdown source. The formatter picks
// its quote style from the content, so the generated statement opts out of formatting; that keeps
// the output the same bytes whatever the markdown says.
const IGNORE = "// biome-ignore format: generated file, the string is one line by design";

export function renderKnowledgeModule(markdown: string): string {
  return `${HEADER}\n${IGNORE}\nexport const ALTTP_KNOWLEDGE = ${JSON.stringify(markdown)};\n`;
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (invokedDirectly) {
  const markdown = readFileSync(KNOWLEDGE_MD, "utf8");
  writeFileSync(KNOWLEDGE_TS, renderKnowledgeModule(markdown));
  console.log(
    `build-knowledge: wrote src/personality/knowledge.ts (${markdown.length} characters)`,
  );
}
