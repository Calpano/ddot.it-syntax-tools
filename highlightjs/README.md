# @calpano/ddot-highlightjs

[highlight.js](https://highlightjs.org) language definition for **ddot.it**
— a minimal text format for typed knowledge graphs.

## Install

```sh
npm install @calpano/ddot-highlightjs highlight.js
```

`highlight.js` is a peer dependency.

## Use

```js
import hljs from 'highlight.js/lib/core';
import ddot from '@calpano/ddot-highlightjs';

hljs.registerLanguage('ddot.it', ddot);

const html = hljs.highlight(code, { language: 'ddot.it' }).value;
```

Aliases registered: `ddot.it`, `ddot`, `ddotit`.

## Theme styling

This language uses ddot-specific scopes (`hljs-subject`, `hljs-relation`,
`hljs-object`, `hljs-operator`, `hljs-command`, `hljs-meta-delim`,
`hljs-meta-operator`, `hljs-meta-relation`, `hljs-meta-object`,
`hljs-meta-text`, `hljs-disabled`). To get reasonable colours from a
generic hljs theme, supply CSS that maps these to themed properties:

```css
.hljs-subject  { color: var(--hljs-name); font-weight: 600; }
.hljs-relation { color: var(--hljs-attr); }
.hljs-object   { color: var(--hljs-string); }
.hljs-operator { color: var(--hljs-punctuation); }
.hljs-command  { color: var(--hljs-keyword); }
.hljs-meta-delim, .hljs-meta-operator,
.hljs-meta-relation, .hljs-meta-object,
.hljs-meta-text { color: var(--hljs-comment); font-style: italic; }
.hljs-disabled { color: var(--hljs-comment); opacity: 0.6; }
```

## Conformance

The lexer is verified against the cross-implementation golden corpus —
identical to the TextMate, Shiki, Pygments, Chroma, and Rouge ports. See
[`tools/conformance-highlightjs.mjs`](https://github.com/Calpano/ddot.it-syntax-tools/blob/main/tools/conformance-highlightjs.mjs).

```sh
npm run conformance:highlightjs
```

## Implementation note

highlight.js's bygroups (`match: [r1,r2,...]` + `scope: {1:'a',2:'b'}`)
keys scope by **array position**, not capture-group index. There's no way
to express "this slot is either a command OR a name" with one rule — so
each line shape is split into two variants (command-subject vs
name-subject). The corpus only ever places commands in the subject slot
(or as standalone off/on markers), so this stays tractable.

A subtler hljs quirk: in a begin/end mode, the inner `contains` rules can
match the end marker before the END regex fires. Our `DISABLED` mode's
inner content rule uses a negative lookahead `(?![ \t]*(?:ddot\.it\/on|!!on)[ \t]*$)`
to avoid swallowing the on-marker line.

## License

MIT
