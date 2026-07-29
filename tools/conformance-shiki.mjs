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

// Cases that cannot pass under Shiki, for reasons outside this grammar.
//
// 17-block — UPSTREAM SHIKI BUG. A `!!block` region ends at the first BLANK
//   line, and Shiki cannot change grammar state across a blank line at all.
//   In @shikijs/primitive/dist/index.mjs the per-line loop reads:
//
//       if (line === "") {
//           actual = [];
//           final.push([]);
//           continue;          // <-- grammar.tokenizeLine() is never called
//       }
//
//   Empty lines are skipped wholesale, so `stateStack` is never advanced
//   through the grammar. Any begin/end rule whose terminator matches an empty
//   line therefore never fires, and the region runs on past it.
//
//   NOT the TextMate engine, and NOT this grammar. The blank line never
//   reaches @shikijs/vscode-textmate, so how the terminator is spelled is
//   irrelevant — `end: "^[ \t]*$"` and `while: "^[ \t]*\S"` (non-zero-width)
//   fail identically. No grammar-level spelling avoids it.
//
//   Verified by patching that guard to advance `stateStack` across empty
//   lines: 17-block then passes, unmodified. (node_modules was restored.)
//   Present in shiki 4.1.0 / @shikijs/primitive 4.1.0.
//
//   Minimal upstream repro, independent of ddot.it — grammar:
//       { begin: "^START$", end: "^[ \t]*$", contentName: "string.body" }
//   input "START\nin1\n\nOUT": `OUT` should be outside the region, but Shiki
//   reports it inside.
//
//   Case 21-block-end-marker exercises the SAME construct with an explicit
//   `?end=MARKER` terminator and DOES pass, because that terminator is a real
//   marker line rather than a blank one. So Shiki's block support is blind
//   only to the blank-line form.
//
// Remove an entry once upstream fixes it; a waiver that starts passing is
// itself reported as a failure below.
const REASON_BLANK_LINE =
  "shiki skips empty lines, so a blank-line region terminator never fires (@shikijs/primitive)";

const KNOWN_ENGINE_DIVERGENCE = new Map([
  // All three are the SAME bug: a !!block terminated by a blank line. They differ only in
  // which field the opener fills -- object, subject, meta object. The ?end=MARKER variants of
  // the same constructs (21-block-end-marker) pass, because their terminator is a real line.
  ["17-block",            REASON_BLANK_LINE],
  ["29-block-subject",    REASON_BLANK_LINE],
  ["30-block-meta-object", REASON_BLANK_LINE],
  // Same bug again: 32-chained-blocks carries TWO blank-line-terminated blocks
  // (a block subject and a block object on one logical line), so the first
  // terminator is missed and the rest of the case is swallowed as verbatim.
  ["32-chained-blocks", REASON_BLANK_LINE],
]);

let failed = 0;
let waived = 0;
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
console.log("\nall cases pass Shiki conformance");
