# @calpano/ddot-prismjs

[Prism.js](https://prismjs.com) language definition for **ddot.it** —
a minimal text format for typed knowledge graphs.

## Install

```sh
npm install @calpano/ddot-prismjs prismjs
```

`prismjs` is a peer dependency.

## Use

```js
import Prism from 'prismjs';
import '@calpano/ddot-prismjs';   // side-effect: registers the language

const html = Prism.highlight(code, Prism.languages['ddot.it'], 'ddot.it');
```

Aliases registered: `ddot.it`, `ddot`, `ddotit`.

## Theme styling

Prism's stock themes don't know about ddot scopes. Add CSS for:
`.token.subject`, `.token.relation`, `.token.object`, `.token.operator`,
`.token.command`, `.token.meta-delim`, `.token.meta-operator`,
`.token.meta-relation`, `.token.meta-object`, `.token.meta-text`,
`.token.disabled`.

## Conformance

Verified against the cross-implementation golden corpus — identical to
the TextMate, Shiki, Pygments, Chroma, Rouge, and highlight.js ports. See
[`tools/conformance-prismjs.mjs`](https://github.com/Calpano/ddot.it-syntax-tools/blob/main/tools/conformance-prismjs.mjs).

```sh
npm run conformance:prismjs
```

## Implementation note

Prism's tokenizer applies patterns in priority order, splitting the
remaining un-tokenized text as it goes. `inside` patterns can't reach
across already-tokenized chunks, so subject/relation/object slot
detection couldn't use the obvious "match operator first, then look at
the gaps" approach.

The lexer instead does everything at the **top level** with Prism's
`lookbehind: true` mechanism. The first capture group of each slot
pattern absorbs the preceding `..` (or `^[ \t]*` for subject) — Prism
strips it from the token but **leaves it in the residual text** for the
later `operator` pattern to claim. Slot patterns therefore run BEFORE
`operator` so their lookbehind can see the `..` markers; `operator`
mops them up afterwards.

Multi-line regions (off-on span, free-form `,,…,,`, typed-meta region)
are matched at the very top with their own `inside` grammars. The
typed-meta region is anchored to body lines starting with `..`, so the
opener line (a normal triple ending in `,,`) is left for the top-level
slot patterns to handle — this is what keeps the opener's operators
scoped as `operator` instead of `meta-operator`.

## License

MIT
