#!/usr/bin/env node
// Regenerates expected.tokens.json under ../ddot.it/test-data/cases/* using
// the live VS Code TextMate grammar.
//
//   node tools/regenerate-tokens.mjs            # write/overwrite
//   node tools/regenerate-tokens.mjs --check    # exit non-zero if any case is stale (CI)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

// Describes how a golden differs from freshly generated tokens: a missing
// file, unparseable JSON, or the first token that disagrees.
function describeDiff(current, tokens) {
  if (current === null) return "no expected.tokens.json (new case in the corpus?)";
  let expected;
  try {
    expected = JSON.parse(current);
  } catch {
    return "expected.tokens.json is not valid JSON";
  }
  const fmt = (t) =>
    t ? `${t.line}:${t.start}-${t.end} ${t.token} ${JSON.stringify(t.text)}` : "(none)";
  const n = Math.max(expected.length, tokens.length);
  for (let i = 0; i < n; i++) {
    if (JSON.stringify(expected[i]) !== JSON.stringify(tokens[i])) {
      return (
        `first difference at token #${i} ` +
        `(expected ${expected.length} tokens, grammar produced ${tokens.length})\n` +
        `          expected: ${fmt(expected[i])}\n` +
        `          actual:   ${fmt(tokens[i])}`
      );
    }
  }
  return "same tokens, different formatting";
}

function corpusCommit() {
  try {
    return execFileSync("git", ["-C", casesDir, "log", "-1", "--format=%h %cs %s"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

const staleCases = [];
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
    staleCases.push(name);
    const kind = current === null ? "MISSING" : "STALE";
    console.log(`  ${kind} ${name}\n        ${describeDiff(current, tokens)}`);
    continue;
  }

  writeFileSync(expectedPath, out);
  written++;
  console.log(`  ${current === null ? "new " : "upd "} ${name}  (${tokens.length} tokens)`);
}

if (checkMode && staleCases.length > 0) {
  const n = staleCases.length;
  console.error(`
${n} case(s) where the TextMate grammar disagrees with expected.tokens.json:
  ${staleCases.join(", ")}

The goldens live in the ddot.it repo, not in this one:
  ${casesDir}
  corpus at: ${corpusCommit()}

Likely causes:
  * The corpus in ddot.it gained or changed cases since this grammar was last
    synced. CI checks out ddot.it's default branch, so this can fail on PRs
    that don't touch the grammar (e.g. Dependabot bumps).
  * A grammar change in this repo altered tokenization.

To fix: update the grammar if the new output is wrong; otherwise run
\`npm run regenerate:tokens\` and commit the updated goldens in ddot.it.`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(
      `::error title=Stale token goldens::${n} ddot.it test case(s) disagree with the grammar ` +
        `(${staleCases.join(", ")}). Corpus at ${corpusCommit()}. ` +
        `Fix the grammar, or run npm run regenerate:tokens and commit in ddot.it.`,
    );
  }
  process.exit(1);
}
console.log(
  checkMode
    ? "\nall cases up to date"
    : `\nwrote ${written} expected.tokens.json file(s)`,
);
