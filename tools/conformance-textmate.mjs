#!/usr/bin/env node
// TextMate conformance: tokenize each ../ddot.it/test-data/cases/*/input.ddot
// with the live VS Code grammar and assert byte equality with the case's
// expected.tokens.json. Fails fast on the first divergence per case.

import { readFileSync, readdirSync, existsSync } from "node:fs";
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

function diffTokens(actual, expected) {
  const lines = [];
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const e = expected[i];
    const eq =
      a && e &&
      a.line === e.line &&
      a.start === e.start &&
      a.end === e.end &&
      a.token === e.token &&
      a.text === e.text;
    if (eq) continue;
    lines.push(`  #${i}`);
    lines.push(`    expected: ${e ? JSON.stringify(e) : "(none)"}`);
    lines.push(`    actual:   ${a ? JSON.stringify(a) : "(none)"}`);
  }
  return lines;
}

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let failed = 0;
let skipped = 0;
for (const name of cases) {
  const input = join(casesDir, name, "input.ddot");
  const expected = join(casesDir, name, "expected.tokens.json");
  if (!existsSync(input)) {
    console.warn(`  skip ${name}: missing input.ddot`);
    continue;
  }
  if (!existsSync(expected)) {
    console.warn(`  skip ${name}: missing expected.tokens.json (run regenerate:tokens)`);
    skipped++;
    continue;
  }
  const src = readFileSync(input, "utf8");
  const actual = await tokenize(src);
  const expectedRaw = JSON.parse(readFileSync(expected, "utf8"));

  const diffs = diffTokens(actual, expectedRaw);
  if (diffs.length === 0) {
    console.log(`PASS  ${name}  (${actual.length} tokens)`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
    for (const l of diffs) console.log(l);
  }
}

if (failed > 0) {
  console.log(`\n${failed} case(s) failed`);
  process.exit(1);
}
if (skipped > 0) {
  console.log(`\n${skipped} case(s) skipped (no expected.tokens.json)`);
}
console.log("\nall cases pass TextMate conformance");
