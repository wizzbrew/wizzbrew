// CI rule checks for the greppable lessons. Forbidden literals are built from pieces so this
// file passes its own scan.
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { MODELS, PRICING } from "../src/llm/models.js";

export type Violation = {
  file: string;
  line: number;
  rule: string;
  message: string;
};

const ENV_READ = "process" + ".env";
const LINK_CALL = "keys" + ".link(";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".vercel",
  "coverage",
  ".idea",
  ".claude",
  "docs",
]);
const SKIP_PATHS = new Set(["tests/fixtures"]);
const SKIP_FILES = new Set(["package-lock.json"]);
const TEXT_EXTS = new Set([".ts", ".js", ".json", ".jsonl", ".md", ".example", ".yml", ".yaml"]);
const CODE_DIRS = ["src", "api", "scripts"];

// Escapes a plain string so it can be searched as a literal.
function literal(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
}

const DISCORD_TOKEN = /[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,}/g;

type Rule = {
  id: string;
  message: string;
  applies: (file: string) => boolean;
  patterns: RegExp[];
};

const isTs = (file: string): boolean => file.endsWith(".ts");
const under = (file: string, dirs: string[]): boolean =>
  dirs.some((dir) => file.startsWith(`${dir}/`));

const RULES: Rule[] = [
  {
    id: "dash",
    message: "em or en dash; use commas, periods, colons or semicolons",
    applies: () => true,
    patterns: [/[\u2013\u2014]/g],
  },
  {
    id: "secret",
    message: "credential shaped string; secrets come from env vars",
    applies: () => true,
    patterns: [literal("sk-" + "ant-"), literal("wizzrobe" + "_pat_"), DISCORD_TOKEN],
  },
  {
    id: "env",
    message: `reads ${ENV_READ} outside src/config.ts`,
    applies: (f) =>
      isTs(f) && under(f, ["src", "api", "scripts", "evals"]) && f !== "src/config.ts",
    patterns: [literal(ENV_READ)],
  },
  {
    id: "time",
    message: "inline date parsing or locale formatting; use src/time/ (L2)",
    applies: (f) => isTs(f) && under(f, CODE_DIRS) && !f.startsWith("src/time/"),
    patterns: [
      literal("Date" + ".parse("),
      literal("new Date" + '("'),
      literal("new Date" + "('"),
      literal("new Date" + "(`"),
      literal("." + "toLocale"),
    ],
  },
  {
    id: "link-key",
    message: `${LINK_CALL} outside src/wizzrobe/identity.ts (L19)`,
    applies: (f) => isTs(f) && under(f, CODE_DIRS) && f !== "src/wizzrobe/identity.ts",
    patterns: [literal(LINK_CALL)],
  },
  {
    id: "empty-catch",
    message: "empty catch block swallows an error",
    applies: isTs,
    patterns: [/\bcatch\s*(?:\([^)]*\)\s*)?\{\s*\}/g],
  },
  {
    id: "dynamic-import",
    message: "dynamic import call; use a static import instead (L22)",
    applies: isTs,
    patterns: [/\bimport\s*\(/g],
  },
];

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

// Collects text files under root, as root relative paths with forward slashes.
function walk(root: string, rel: string, out: string[]): void {
  const dir = rel === "" ? root : join(root, rel);
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || SKIP_PATHS.has(childRel)) {
        continue;
      }
      walk(root, childRel, out);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) {
        continue;
      }
      if (TEXT_EXTS.has(extname(entry.name))) {
        out.push(childRel);
      }
    }
  }
}

export function scanRepo(root: string): {
  files: string[];
  violations: Violation[];
} {
  const files: string[] = [];
  walk(root, "", files);
  const violations: Violation[] = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const rule of RULES) {
      if (!rule.applies(file)) {
        continue;
      }
      // One violation per rule per line, however many times it matches there.
      const seen = new Set<number>();
      for (const pattern of rule.patterns) {
        for (const match of text.matchAll(pattern)) {
          const line = lineOf(text, match.index ?? 0);
          if (seen.has(line)) {
            continue;
          }
          seen.add(line);
          violations.push({ file, line, rule: rule.id, message: rule.message });
        }
      }
    }
  }
  return { files, violations };
}

export function runChecks(root: string): Violation[] {
  return scanRepo(root).violations;
}

// Returns the model ids (values of MODELS) that have no entry in PRICING.
export function checkPricing(
  models: Record<string, string>,
  pricing: Record<string, unknown>,
): string[] {
  const missing = new Set<string>();
  for (const id of Object.values(models)) {
    if (!Object.hasOwn(pricing, id)) {
      missing.add(id);
    }
  }
  return [...missing];
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (invokedDirectly) {
  const { files, violations } = scanRepo(process.cwd());
  const lines = violations.map((v) => `${v.file}:${v.line} ${v.rule} ${v.message}`);
  for (const id of checkPricing(MODELS, PRICING)) {
    lines.push(`src/llm/models.ts:1 pricing no PRICING entry for model id ${id}`);
  }
  if (lines.length > 0) {
    for (const line of lines) {
      console.log(line);
    }
    process.exit(1);
  }
  console.log(`check-rules: ok (${files.length} files)`);
  process.exit(0);
}
