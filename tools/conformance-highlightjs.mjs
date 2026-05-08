#!/usr/bin/env node
// highlight.js conformance: load ../highlightjs/index.js, tokenize each
// case input, parse the emitted HTML to extract scoped spans, map hljs
// scopes to canonical token names, diff against expected.tokens.json.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import hljsCore from "highlight.js/lib/core";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const casesDir = resolve(repoRoot, "../ddot.it/test-data/cases");

const langModule = await import(resolve(repoRoot, "highlightjs/index.js"));
hljsCore.registerLanguage("ddot.it", langModule.default);

// hljs scope (CSS class without `hljs-` prefix) → canonical token name.
// Our hljs scopes already match canonical names directly.
const HLJS_TO_CANONICAL = {
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

// Decode HTML entities hljs produces.
function decode(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'");
}

// Parse hljs's HTML span output into { line, start, end, scope, text } tokens.
// hljs emits a flat sequence of <span class="hljs-X">…</span> mixed with
// plain text. Spans can nest in some configurations; we walk linearly with a
// stack to support that.
function parseHljs(html, src) {
  // First, walk the HTML producing (text, scopeStack) chunks.
  const chunks = [];
  const stack = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      // tag
      const close = html.indexOf(">", i);
      const tag = html.slice(i, close + 1);
      if (tag.startsWith("<span")) {
        const m = tag.match(/class="hljs-([^"]+)"/);
        stack.push(m ? m[1] : null);
      } else if (tag.startsWith("</span>")) {
        stack.pop();
      }
      i = close + 1;
    } else {
      const next = html.indexOf("<", i);
      const text = decode(html.slice(i, next === -1 ? html.length : next));
      if (text) chunks.push({ text, scopes: stack.slice() });
      i = next === -1 ? html.length : next;
    }
  }
  // Walk chunks against src to compute (line, col) for each.
  const out = [];
  let pos = 0;
  let line = 0;
  let col = 0;
  for (const ch of chunks) {
    // Sanity: chunk text should match src starting at pos.
    if (src.slice(pos, pos + ch.text.length) !== ch.text) {
      // Sometimes hljs swallows whitespace differently; try to advance.
      // For our cases this should not happen; report and skip.
      throw new Error(
        `hljs/src mismatch at pos ${pos}: src=${JSON.stringify(src.slice(pos, pos + 20))} hljs=${JSON.stringify(ch.text.slice(0, 20))}`,
      );
    }
    let i = 0;
    while (i < ch.text.length) {
      const nl = ch.text.indexOf("\n", i);
      const segEnd = nl === -1 ? ch.text.length : nl;
      const segment = ch.text.slice(i, segEnd);
      if (segment) {
        const innermost = ch.scopes.findLast?.((s) => s) ?? ch.scopes[ch.scopes.length - 1];
        const canonical = innermost ? HLJS_TO_CANONICAL[innermost] : null;
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
        pos += segment.length;
      }
      if (nl !== -1) {
        line++;
        col = 0;
        pos += 1; // newline
        i = nl + 1;
      } else {
        i = segEnd;
      }
    }
  }
  return out;
}

function diffTokens(actual, expected) {
  const lines = [];
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const e = expected[i];
    const eq =
      a && e &&
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
  const r = hljsCore.highlight(src, { language: "ddot.it" });
  let actual;
  try {
    actual = parseHljs(r.value, src);
  } catch (err) {
    console.log(`FAIL  ${name}  (parse error: ${err.message})`);
    failed++;
    continue;
  }
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
