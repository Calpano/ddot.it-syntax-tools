#!/usr/bin/env node
// Shiki conformance: load @calpano/ddot-shiki via Shiki's createHighlighter,
// tokenize each ../ddot.it/test-data/cases/*/input.ddot, map scopes to
// canonical tokens, diff against expected.tokens.json.
//
// Smoke-test purpose: validates that the Shiki integration package wires up
// correctly. Token-level guarantees come from conformance-textmate (Shiki
// uses the same Oniguruma/TextMate engine under the hood, so divergence
// here would mean a packaging bug, not a grammar bug).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHighlighter } from "shiki";
import ddotLanguage from "@calpano/ddot-shiki";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const casesDir = resolve(repoRoot, "../ddot.it/test-data/cases");

if (!existsSync(casesDir)) {
  console.error(`cases dir not found: ${casesDir}`);
  process.exit(2);
}

// Same priority order as tools/textmate-tokenize.mjs.
const SCOPE_TO_TOKEN = [
  ["keyword.control.ddot",                "command"],
  ["entity.name.operator.ddot",           "operator"],
  ["entity.name.subject.ddot",            "subject"],
  ["entity.name.relation.ddot",           "relation"],
  ["entity.name.object.ddot",             "object"],
  ["comment.metadata.operator.ddot",      "meta-operator"],
  ["comment.metadata.subject.ddot",       "meta-subject"],
  ["comment.metadata.relation.ddot",      "meta-relation"],
  ["comment.metadata.object.ddot",        "meta-object"],
  ["punctuation.definition.comment.ddot", "meta-delim"],
  ["comment.block.disabled.ddot",         "disabled"],
  ["comment.metadata.ddot",               "meta-text"],
];

function classifyScopes(scopeNames) {
  for (const [scope, token] of SCOPE_TO_TOKEN) {
    if (scopeNames.includes(scope)) return token;
  }
  return null;
}

function coalesce(tokens) {
  const out = [];
  for (const t of tokens) {
    const last = out.at(-1);
    if (
      last &&
      last.line === t.line &&
      last.end === t.start &&
      last.token === t.token
    ) {
      last.end = t.end;
      last.text += t.text;
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

const highlighter = await createHighlighter({
  themes: ["github-light"],
  langs: [ddotLanguage],
});

function tokenize(src) {
  const lines = src.split("\n");
  // Line-start offsets in the (document-relative) coordinate Shiki returns.
  const lineStarts = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineStarts.push(lineStarts[i] + lines[i].length + 1); // +1 for the \n
  }
  const themed = highlighter.codeToTokensBase(src, {
    lang: "ddot.it",
    includeExplanation: "scopeName",
  });
  const out = [];
  for (let lineIdx = 0; lineIdx < themed.length; lineIdx++) {
    const lineLen = lines[lineIdx]?.length ?? 0;
    const lineStart = lineStarts[lineIdx];
    for (const tok of themed[lineIdx]) {
      let subOffset = tok.offset - lineStart;
      for (const exp of tok.explanation ?? []) {
        const start = subOffset;
        const end = Math.min(start + exp.content.length, lineLen);
        subOffset += exp.content.length;
        if (end <= start) continue;
        const text = exp.content.slice(0, end - start);
        if (text.length === 0 || /^\s+$/.test(text)) continue;
        const scopeNames = exp.scopes.map((s) => s.scopeName);
        const token = classifyScopes(scopeNames);
        if (token === null) {
          out.push({ line: lineIdx, start, end, token: "(unclassified)", text, scopes: scopeNames });
          continue;
        }
        out.push({ line: lineIdx, start, end, token, text });
      }
    }
  }
  return coalesce(out);
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
for (const name of cases) {
  const input = join(casesDir, name, "input.ddot");
  const expected = join(casesDir, name, "expected.tokens.json");
  if (!existsSync(input) || !existsSync(expected)) {
    console.warn(`  skip ${name}`);
    continue;
  }
  const src = readFileSync(input, "utf8");
  const actual = tokenize(src);
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
console.log("\nall cases pass Shiki conformance");
