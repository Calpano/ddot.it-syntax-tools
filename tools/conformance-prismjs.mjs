#!/usr/bin/env node
// Prism.js conformance: load ../prismjs/index.js, tokenize each case input,
// walk the Prism token tree to extract scoped leaves, map Prism token names
// to canonical, diff against expected.tokens.json.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Prism from "prismjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const casesDir = resolve(repoRoot, "../ddot.it/test-data/cases");

await import(resolve(repoRoot, "prismjs/index.js"));  // registers language

// Prism token type / alias → canonical name. Multiple Prism types alias the
// same canonical scope; we walk to the innermost meaningful type.
const PRISM_TO_CANONICAL = {
  subject:        "subject",
  relation:       "relation",
  object:         "object",
  operator:       "operator",
  command:        "command",
  "meta-delim":   "meta-delim",
  "meta-operator": "meta-operator",
  "meta-relation": "meta-relation",
  "meta-object":  "meta-object",
  "meta-text":    "meta-text",
  disabled:       "disabled",
};

// Outer wrapper types to ignore (they're region containers, not leaves).
const IGNORE_OUTER = new Set([
  "disabled-region",
  "typed-meta-region",
  "meta-text-region",
  "typed-triple",
  "untyped-triple",
  "typed-cont",
  "untyped-cont",
  "typed-meta-cont",
  "opening-typed-triple",
  "opening-untyped-triple",
  "opening-typed-cont",
  "opening-untyped-cont",
  "stray-meta-delim",
]);

// Walk Prism tokens and produce flat (line, start, end, scope, text) entries.
function tokenize(src) {
  const tokens = Prism.tokenize(src, Prism.languages["ddot.it"]);
  const out = [];
  let line = 0;
  let col = 0;

  function advance(text) {
    let i = 0;
    while (i < text.length) {
      const nl = text.indexOf("\n", i);
      if (nl === -1) {
        col += text.length - i;
        return;
      }
      // text[i..nl) on current line
      col += nl - i;
      line++;
      col = 0;
      i = nl + 1;
    }
  }

  function walk(node, scopeStack) {
    if (typeof node === "string") {
      // Plain text — emit per-line scoped chunks for the innermost scope.
      const innermost = scopeStack.findLast?.((s) => !IGNORE_OUTER.has(s)) ??
        scopeStack.slice().reverse().find((s) => !IGNORE_OUTER.has(s));
      const canonical = innermost ? PRISM_TO_CANONICAL[innermost] : null;
      let i = 0;
      while (i < node.length) {
        const nl = node.indexOf("\n", i);
        const segEnd = nl === -1 ? node.length : nl;
        const segment = node.slice(i, segEnd);
        if (segment) {
          if (canonical && segment.trim() !== "") {
            out.push({
              line,
              start: col,
              end: col + segment.length,
              token: canonical,
              text: segment,
            });
          }
          col += segment.length;
        }
        if (nl !== -1) {
          line++;
          col = 0;
          i = nl + 1;
        } else {
          break;
        }
      }
      return;
    }
    // Token object
    const newStack = [...scopeStack, node.type, ...(node.alias ? [].concat(node.alias) : [])];
    if (typeof node.content === "string") {
      walk(node.content, newStack);
    } else if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child, newStack);
    }
  }

  for (const tok of tokens) walk(tok, []);
  return out;
}

function diffTokens(actual, expected) {
  const lines = [];
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const e = expected[i];
    const eq = a && e &&
      a.line === e.line && a.start === e.start && a.end === e.end &&
      a.token === e.token && a.text === e.text;
    if (eq) continue;
    lines.push(`  #${i}`);
    lines.push(`    expected: ${e ? JSON.stringify(e) : "(none)"}`);
    lines.push(`    actual:   ${a ? JSON.stringify(a) : "(none)"}`);
    if (lines.length > 30) break;
  }
  return lines;
}

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let failed = 0;
for (const name of cases) {
  const inputPath = join(casesDir, name, "input.ddot");
  const expectedPath = join(casesDir, name, "expected.tokens.json");
  if (!existsSync(inputPath) || !existsSync(expectedPath)) {
    console.log(`skip  ${name}`);
    continue;
  }
  const src = readFileSync(inputPath, "utf8");
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  let actual;
  try { actual = tokenize(src); }
  catch (err) { console.log(`FAIL  ${name}  (tokenize: ${err.message})`); failed++; continue; }
  const diffs = diffTokens(actual, expected);
  if (diffs.length === 0) {
    console.log(`ok    ${name}`);
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
console.log(`\nall ${cases.length} cases pass`);
