# @calpano/ddot-textmate-grammar

Canonical TextMate grammar for **ddot.it** — a minimal text format for typed
knowledge graphs.

This is the source-of-truth grammar consumed by:

- the VS Code extension (`ddot.it-vscode`),
- the cross-implementation conformance harness (`ddot.it-syntax-tools/tools/`),
- Shiki and any other TextMate-compatible highlighter.

## Install

```sh
npm install @calpano/ddot-textmate-grammar
```

## Use

### Plain JSON

```js
import grammarJson from "@calpano/ddot-textmate-grammar/grammar"; // resolves to ddot.tmLanguage.json
```

### Helper export

```js
import { name, scopeName, loadGrammar, grammarPath } from "@calpano/ddot-textmate-grammar";

console.log(name);          // "ddot.it"
console.log(scopeName);     // "source.ddot"
const grammar = loadGrammar();
```

`grammarPath` is the absolute filesystem path to the `.tmLanguage.json` file —
useful for tools that want to load it themselves (e.g. `vscode-textmate`,
custom Shiki bundles).

## Conformance

Every implementation that ships this grammar must produce the canonical
token stream defined by
[`ddot.it/test-data/tokens.md`](https://github.com/Calpano/ddot.it/blob/main/test-data/tokens.md).
The reference golden corpus is at
[`ddot.it/test-data/cases/`](https://github.com/Calpano/ddot.it/tree/main/test-data/cases).

## License

MIT
