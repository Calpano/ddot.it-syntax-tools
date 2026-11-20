# @calpano/ddot-shiki

[Shiki](https://shiki.style) language registration for **ddot.it** —
a minimal text format for typed knowledge graphs.

Wraps the canonical TextMate grammar (`@calpano/ddot-textmate-grammar`) so
any Shiki-based highlighter can render `ddot.it` without redefining rules.

## Install

```sh
npm install @calpano/ddot-shiki shiki
```

`shiki` is a peer dependency.

## Use

```js
import { createHighlighter } from "shiki";
import ddot, { ddotBlankLines } from "@calpano/ddot-shiki";

const highlighter = await createHighlighter({
  themes: ["github-light"],
  langs: [ddot],
});

const code = `Project Eagle ..started in.. 2024
..doc site.. example.com/docbase/8dcjsid`;

const html = highlighter.codeToHtml(code, {
  lang: "ddot.it",
  theme: "github-light",
  transformers: [ddotBlankLines],
});
```

See [Blank lines](#blank-lines) for why the transformer is needed.

The aliases `ddot.it`, `ddot`, and `ddotit` all resolve to this grammar
(matching the existing IntelliJ and VS Code conventions).

## Theme mapping

Themes that style standard TextMate scopes will work out of the box.
`ddot.it`-specific scopes the grammar emits:

| Scope                                    | What                                   |
|------------------------------------------|----------------------------------------|
| `entity.name.subject.ddot`               | First slot of a triple                 |
| `entity.name.relation.ddot`              | Predicate slot of a typed triple       |
| `entity.name.object.ddot`                | Object slot                            |
| `keyword.operator.doubledot.ddot`        | `..` / `....` / `.. ..` separator      |
| `keyword.control.command.ddot`           | `ddot.it…`, `!!…` commands             |
| `variable.parameter.command.ddot`        | A command's query/fragment (`?end=`)   |
| `punctuation.section.meta.ddot`          | `,,` opening/closing metadata          |
| `punctuation.separator.meta.ddot`        | `;;` between inline metadata pairs     |
| `keyword.operator.doubledot.meta.ddot`   | `..` inside metadata                   |
| `entity.name.relation.meta.ddot`         | Predicate inside metadata              |
| `entity.name.object.meta.ddot`           | Object inside metadata                 |
| `entity.name.object.meta.text.ddot`      | Free-form text inside a `,,` block     |
| `comment.block.excluded.ddot`            | `off`–`on` muted span                  |
| `string.unquoted.block.ddot`             | `!!block` verbatim body                |
| `variable.parameter.block-end.ddot`      | Custom marker in `!!block?end=MARKER`  |

Metadata shares the `entity.name.*` / `keyword.operator.*` roots with the main
triple, so it renders as first-class content rather than as a comment. The
`.meta` component exists so a theme *can* single it out, not so it must.

For the canonical token vocabulary and conformance protocol see
[`ddot.it/test-data/tokens.md`](https://github.com/Calpano/ddot.it/blob/main/test-data/tokens.md).

## Blank lines

**Pass `ddotBlankLines` in `transformers`**, or a `!!block` that ends at a blank
line is not ended: the rest of the document is highlighted as block content.

Shiki never hands an empty line to the grammar. Its per-line loop in
`@shikijs/primitive` skips them:

```js
if (line === "") {
    actual = [];
    final.push([]);
    continue;          // the grammar is never called for this line
}
```

So the grammar's state cannot change at a blank line, and a TextMate
`begin`/`end` rule whose end matches an empty line never fires. This is not
specific to ddot.it: heredocs and other blank-line-terminated constructs are
affected too. The grammar itself is correct in VS Code and anything else built
on `vscode-textmate`. Minimal reproduction:

```js
// grammar
{ begin: "^START$", end: "^[ \t]*$", contentName: "string.body" }
// input:  "START\nin1\n\nOUT"
// expected: OUT is outside the region.   actual (Shiki): OUT is inside it.
```

`ddotBlankLines` works around it: its `preprocess` hook replaces each empty
line with a single space. A whitespace-only line ends the block just like an
empty one, and Shiki does pass it to the grammar. The output differs only by
that invisible space; character offsets after a blank line shift by one per
blank line before them.

- Shiki runs `preprocess` in `codeToHtml` and `codeToHast`, and so in
  integrations built on them (rehype, Astro, VitePress, markdown-it). With
  `codeToTokens`, call `fillBlankLines(code)` yourself first.
- The hook sees all the code of one Shiki call. When Markdown with ```` ```ddot ````
  fences is highlighted as one document, all its blank lines get the space.
- Blocks with an explicit end, `!!block?end=MARKER`, end at a real marker line
  and need no transformer.

Seen in Shiki up to 4.6.0. The conformance harness
(`tools/conformance-shiki.mjs`) reports when a Shiki release stops skipping
empty lines, so the transformer can be retired.

## License

MIT
