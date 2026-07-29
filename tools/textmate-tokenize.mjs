// Shared TextMate tokenizer: takes the live VS Code grammar + a .ddot
// source string, returns the canonical token array used by
// expected.tokens.json — `{line, start, end, token, text}` (zero-indexed,
// end-exclusive, whitespace dropped).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vsctmPkg from "vscode-textmate";
import onigPkg from "vscode-oniguruma";

const vsctm = vsctmPkg;
const oniguruma = onigPkg;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

export const GRAMMAR_PATH = resolve(
  repoRoot,
  "textmate/ddot.tmLanguage.json",
);

// Highest-priority match wins. The command scopes come first because the
// grammar nests them INSIDE a field capture: a slot whose text is entirely a
// command (`ddot.it/this` as a subject) must report `command`, not `subject`.
// See ../../ddot.it/test-data/tokens.md, which is normative for these names.
export const SCOPE_TO_TOKEN = [
  ["keyword.control.command.ddot",         "command"],
  ["variable.parameter.command.ddot",      "command-param"],
  ["variable.parameter.block-end.ddot",    "block-end"],
  ["entity.name.subject.ddot",             "subject"],
  ["entity.name.relation.meta.ddot",       "meta-relation"],
  ["entity.name.relation.ddot",            "relation"],
  ["entity.name.object.meta.text.ddot",    "meta-text"],
  ["entity.name.object.meta.ddot",         "meta-object"],
  ["entity.name.object.ddot",              "object"],
  ["keyword.operator.doubledot.meta.ddot", "meta-doubledot"],
  ["keyword.operator.doubledot.ddot",      "doubledot"],
  ["punctuation.section.meta.ddot",        "meta-delim"],
  ["punctuation.separator.meta.ddot",      "meta-separator"],
  ["comment.block.excluded.ddot",          "excluded"],
  ["string.unquoted.block.ddot",           "verbatim"],
];

export function classifyScopes(scopes) {
  for (const [scope, token] of SCOPE_TO_TOKEN) {
    if (scopes.includes(scope)) return token;
  }
  return null;
}

// Distinguish "deliberately unstyled" from "styled with a scope we don't know".
//
// Text the grammar never claimed carries only the root scope; it is plain host
// text and must NOT be tokenized at all -- see test-data/README.md ("lines that
// produce no tokens are absent"), which is what lets a negative case assert an
// empty token stream.
//
// A token that DOES carry a ddot-specific scope the map has no entry for is a
// real defect: either the grammar grew a scope or the map went stale. Those are
// emitted as `(unclassified)` with their scope stack, so they show up loudly
// instead of silently vanishing.
export function hasUnmappedDdotScope(scopes) {
  return scopes.some((s) => s !== "source.ddot" && s.endsWith(".ddot"));
}

let grammarPromise = null;
async function loadGrammar() {
  if (grammarPromise) return grammarPromise;
  const onigBin = readFileSync(
    resolve(repoRoot, "node_modules/vscode-oniguruma/release/onig.wasm"),
  );
  await oniguruma.loadWASM(onigBin);
  const onigLib = Promise.resolve({
    createOnigScanner: (p) => new oniguruma.OnigScanner(p),
    createOnigString: (s) => new oniguruma.OnigString(s),
  });
  const registry = new vsctm.Registry({
    onigLib,
    loadGrammar: async (sc) => {
      if (sc !== "source.ddot") return null;
      const raw = readFileSync(GRAMMAR_PATH, "utf8");
      return vsctm.parseRawGrammar(raw, GRAMMAR_PATH);
    },
  });
  grammarPromise = registry.loadGrammar("source.ddot");
  return grammarPromise;
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

export async function tokenize(src) {
  const grammar = await loadGrammar();
  if (!grammar) throw new Error(`could not load grammar at ${GRAMMAR_PATH}`);
  const lines = src.split("\n");
  const out = [];
  let stack = vsctm.INITIAL;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const r = grammar.tokenizeLine(line, stack);
    stack = r.ruleStack;
    for (const tok of r.tokens) {
      // vscode-textmate sometimes extends the last token of a line past
      // line.length to absorb the implicit newline. Clamp.
      const endIndex = Math.min(tok.endIndex, line.length);
      if (endIndex <= tok.startIndex) continue;
      const text = line.slice(tok.startIndex, endIndex);
      if (text.length === 0 || /^\s+$/.test(text)) continue;
      const token = classifyScopes(tok.scopes);
      if (token === null) {
        // Plain host text the grammar never claimed -- emit nothing.
        if (!hasUnmappedDdotScope(tok.scopes)) continue;
        // A ddot scope with no mapping: surface it loudly.
        out.push({
          line: lineIdx,
          start: tok.startIndex,
          end: endIndex,
          token: "(unclassified)",
          text,
          scopes: tok.scopes,
        });
        continue;
      }
      out.push({
        line: lineIdx,
        start: tok.startIndex,
        end: endIndex,
        token,
        text,
      });
    }
  }
  return coalesce(out);
}
