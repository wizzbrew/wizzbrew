import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkPricing, runChecks } from "../../scripts/check-rules.js";

// Every forbidden literal is built from pieces so this file passes the scan it tests.
const EM = "\u2014";
const EN = "\u2013";
const SK = "sk-" + "ant-";
const WP = "wizzrobe" + "_pat_";
const SK_FULL = `${SK}${"a1b2".repeat(6)}`;
const WP_FULL = `${WP}${"a1b2".repeat(5)}`;
const ENV = "process" + ".env";
const DATE_PARSE = "Date" + ".parse(";
const NEW_DATE = "new " + 'Date("2026");';
const LINK = "keys" + ".link(";
const AWAIT_IMPORT = "await " + "import" + '("x")';
const EMPTY_CATCH = "catch" + " {}";
const EMPTY_CATCH_BINDING = "catch (e) " + "{   }";
const TRY = "try { run(); } ";
const TOKEN = `M${"a".repeat(24)}.abcdef.${"b".repeat(27)}`;

const PLANTED: Record<string, string> = {
  "notes.md": `one ${EM} two\nthree ${EN} four\n`,
  "src/secret.ts": `export const k = "${SK_FULL}";\n`,
  "src/token.ts": `export const t = "${TOKEN}";\n`,
  "src/env.ts": `export const v = ${ENV}.FOO;\n`,
  "src/config.ts": `export const v = ${ENV}.FOO;\n`,
  "tests/setup.ts": `export const v = ${ENV}.FOO;\n`,
  "src/a.ts": `export const d = ${DATE_PARSE}"2026");\n${LINK}"x");\n${TRY}${EMPTY_CATCH}\n`,
  "src/b.ts": `${TRY}${EMPTY_CATCH_BINDING}\n`,
  "src/c.ts": `export const m = ${AWAIT_IMPORT};\n`,
  "src/d.ts": `export const e = ${NEW_DATE}\n`,
  "src/time/time.ts": `export const d = ${DATE_PARSE}"2026");\n`,
  "src/wizzrobe/identity.ts": `export const x = ${LINK}"x");\n`,
  "docs/plan.md": `one ${EM} two\n`,
  "docs/e.ts": `export const d = ${DATE_PARSE}"2026");\n${ENV}.FOO;\n${TRY}${EMPTY_CATCH}\n${AWAIT_IMPORT};\n`,
  "tests/fixtures/f.ts": `export const d = ${DATE_PARSE}"2026");\n${ENV}.FOO;\n${TRY}${EMPTY_CATCH}\n${AWAIT_IMPORT};\n`,
  "package-lock.json": `{"k": "${SK_FULL}"}\n`,
  "node_modules/pkg/index.ts": `export const k = "${SK_FULL}";\n`,
  "prose.md": `a ${WP} token is named here\nand ${SK} is a prefix\n`,
  "tokens.md": `has ${WP_FULL} in it\nand ${SK_FULL} too\n`,
  "src/e.ts": `// stored at ${LINK}id)\nconst k = ${LINK}id); // note\n`,
  "src/f.ts": `/**\n * ${ENV} is read elsewhere\n */\nexport const x = 1;\n`,
  "src/h.ts": `// ${TRY}${EMPTY_CATCH}\n${TRY}catch {\n  // intentional\n}\n`,
  "src/g.ts": `const u = "https://x.test"; ${DATE_PARSE}s);\n`,
};

const EXPECTED = [
  "notes.md:1:dash",
  "notes.md:2:dash",
  "src/secret.ts:1:secret",
  "src/token.ts:1:secret",
  "src/env.ts:1:env",
  "src/a.ts:1:time",
  "src/a.ts:2:link-key",
  "src/a.ts:3:empty-catch",
  "src/b.ts:1:empty-catch",
  "src/c.ts:1:dynamic-import",
  "src/d.ts:1:time",
  "tokens.md:1:secret",
  "tokens.md:2:secret",
  "src/e.ts:2:link-key",
  "src/g.ts:1:time",
];

describe("runChecks", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wizzbrew-rules-"));
    for (const [rel, content] of Object.entries(PLANTED)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), content);
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports exactly the planted violations and ignores skipped paths", () => {
    const got = runChecks(root).map((v) => `${v.file}:${v.line}:${v.rule}`);
    expect([...got].sort()).toEqual([...EXPECTED].sort());
  });

  it("reports nothing for the repo's own scripts/check-rules.ts", () => {
    const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
    const own = runChecks(repoRoot).filter((v) => v.file === "scripts/check-rules.ts");
    expect(own).toEqual([]);
  });
});

describe("checkPricing", () => {
  it("returns the model ids that have no PRICING entry", () => {
    expect(
      checkPricing(
        { router: "claude-haiku-5-5", responder: "claude-sonnet-5-5" },
        { "claude-haiku-5-5": {} },
      ),
    ).toEqual(["claude-sonnet-5-5"]);
  });
});
