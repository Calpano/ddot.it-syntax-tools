#!/usr/bin/env node
// Regenerates expected.tokens.json under ../ddot.it/test-data/cases/* using
// the live VS Code TextMate grammar.
//
//   node tools/regenerate-tokens.mjs            # write/overwrite
//   node tools/regenerate-tokens.mjs --check    # exit non-zero if any case is stale (CI)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./textmate-tokenize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const casesDir = resolve(repoRoot, "../ddot.it/test-data/cases");

if (!existsSync(casesDir)) {
  console.error(`cases dir not found: ${casesDir}`);
  console.error("expected ../ddot.it and this repo to live as siblings.");
  process.exit(2);
}

const checkMode = process.argv.includes("--check");

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let stale = 0;
let written = 0;
for (const name of cases) {
  const input = join(casesDir, name, "input.ddot");
  if (!existsSync(input)) {
    console.warn(`  skip ${name}: missing input.ddot`);
    continue;
  }
  const src = readFileSync(input, "utf8");
  const tokens = await tokenize(src);
  const out = JSON.stringify(tokens, null, 2) + "\n";
  const expectedPath = join(casesDir, name, "expected.tokens.json");
  const current = existsSync(expectedPath)
    ? readFileSync(expectedPath, "utf8")
    : null;

  if (current === out) {
    console.log(`  ok   ${name}  (${tokens.length} tokens)`);
    continue;
  }

  if (checkMode) {
    stale++;
    console.log(`  STALE ${name}`);
    continue;
  }

  writeFileSync(expectedPath, out);
  written++;
  console.log(`  ${current === null ? "new " : "upd "} ${name}  (${tokens.length} tokens)`);
}

if (checkMode && stale > 0) {
  console.error(`\n${stale} case(s) stale — run \`npm run regenerate:tokens\` and commit.`);
  process.exit(1);
}
console.log(
  checkMode
    ? "\nall cases up to date"
    : `\nwrote ${written} expected.tokens.json file(s)`,
);
