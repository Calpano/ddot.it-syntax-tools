# @calpano/ddot-parser

The canonical JavaScript parser for [ddot.it](https://ddot.it) — Knowledge Graph
Notation.

```js
import { tokenize, parseEvents, indexToDdot } from '@calpano/ddot-parser';

tokenize('Alice ..knows.. Bob');
// [{ line: 0, start: 0, end: 5, token: 'subject', text: 'Alice' }, …]

parseEvents('Alice ..knows.. Bob', 'ddot', 'a.ddot');
// [{ from: 'Alice', type: 'knows', to: 'Bob', kind: 'ddot', … }]
```

## `ddot-index`

Index a file to `.ddot` triple lines:

```shell
npx @calpano/ddot-parser ddot-index site/spec/ddot-it-vocabulary.adoc -o out.ddot
```

The **whole file** is parsed. ddot.it is a guest language, so triples are found
wherever they occur; `ddot.it/off` … `ddot.it/on` is what gates a document that
should expose only some regions.

## Conformance

`tokenize` and `parseEvents` are asserted against every case in the
cross-implementation corpus (`ddot.it/test-data/cases/`) by this repository's
`npm run conformance:parser` — the same corpus that pins the canonical TextMate
grammar and the six highlighter mirrors. The token stream is canonical from
TextMate; the event stream from the Java `DdotEventExporter`.
