import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const name = "ddot.it";
export const scopeName = "source.ddot";
export const grammarPath = resolve(here, "ddot.tmLanguage.json");

let _grammar;
export function loadGrammar() {
  if (!_grammar) _grammar = JSON.parse(readFileSync(grammarPath, "utf8"));
  return _grammar;
}

export default { name, scopeName, grammarPath, loadGrammar };
