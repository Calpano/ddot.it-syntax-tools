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
import ddotLanguage, { fillBlankLines } from "@calpano/ddot-shiki";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const casesDir = resolve(repoRoot, "../ddot.it/test-data/cases");

if (!existsSync(casesDir)) {
  console.error(`cases dir not found: ${casesDir}`);
  process.exit(2);
}

// Single source of truth: the same map the canonical tokenizer uses.
import {
  classifyScopes,
  hasUnmappedDdotScope,
} from "./textmate-tokenize.mjs";

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
          // Plain host text the grammar never claimed -- emit nothing.
          if (!hasUnmappedDdotScope(scopeNames)) continue;
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

// Every case is tokenized the way the package README says to use it: through
// `fillBlankLines` (the `ddotBlankLines` transformer). Shiki skips empty lines
// without calling the grammar (`if (line === "") continue` in
// @shikijs/primitive), so without it a `!!block` that ends at a blank line runs
// on: cases 17, 29, 30, 32, 33 and 34 fail. The check after the loop tells when
// a Shiki release stops skipping them, so the transformer can be retired.
//
// Cases that cannot pass under Shiki even so, for reasons outside this grammar.
// A waiver that starts passing is itself reported as a failure below.
const KNOWN_ENGINE_DIVERGENCE = new Map([]);

let failed = 0;
let waived = 0;
/** Cases that pass only with fillBlankLines: the upstream empty-line skip still bites. */
const needBlankLineFix = [];
for (const name of cases) {
  const input = join(casesDir, name, "input.ddot");
  const expected = join(casesDir, name, "expected.tokens.json");
  if (!existsSync(input) || !existsSync(expected)) {
    console.warn(`  skip ${name}`);
    continue;
  }
  const src = readFileSync(input, "utf8");
  const actual = tokenize(fillBlankLines(src));
  if (diffTokens(tokenize(src), JSON.parse(readFileSync(expected, "utf8"))).length > 0) {
    needBlankLineFix.push(name);
  }
  const expectedRaw = JSON.parse(readFileSync(expected, "utf8"));
  const diffs = diffTokens(actual, expectedRaw);
  if (diffs.length === 0) {
    // A waiver that starts passing is itself a failure: it means the upstream
    // bug is fixed and the entry must be removed rather than silently kept.
    if (KNOWN_ENGINE_DIVERGENCE.has(name)) {
      failed++;
      console.log(`FAIL  ${name} — now PASSES; remove it from KNOWN_ENGINE_DIVERGENCE`);
      continue;
    }
    console.log(`PASS  ${name}  (${actual.length} tokens)`);
  } else if (KNOWN_ENGINE_DIVERGENCE.has(name)) {
    waived++;
    console.log(`WAIVED ${name} — ${KNOWN_ENGINE_DIVERGENCE.get(name)}`);
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
if (waived > 0) {
  console.log(`\n${waived} case(s) waived (known upstream engine divergence)`);
}
console.log(needBlankLineFix.length > 0
  ? `\n${needBlankLineFix.length} case(s) pass only with fillBlankLines (Shiki still skips empty lines): ${needBlankLineFix.join(", ")}`
  : "\nNo case needs fillBlankLines any more: Shiki now tokenizes empty lines, so ddotBlankLines can be retired.");
console.log("\nall cases pass Shiki conformance");
