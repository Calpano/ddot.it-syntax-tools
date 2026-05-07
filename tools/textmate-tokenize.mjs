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

// Highest-priority match wins.
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

function classifyScopes(scopes) {
  for (const [scope, token] of SCOPE_TO_TOKEN) {
    if (scopes.includes(scope)) return token;
  }
  return null;
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
