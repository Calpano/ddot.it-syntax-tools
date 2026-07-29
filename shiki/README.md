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
import ddot from "@calpano/ddot-shiki";

const highlighter = await createHighlighter({
  themes: ["github-light"],
  langs: [ddot],
});

const code = `Project Eagle ..started in.. 2024
..doc site.. example.com/docbase/8dcjsid`;

const html = highlighter.codeToHtml(code, {
  lang: "ddot.it",
  theme: "github-light",
});
```

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

## Known limitation: `!!block` and blank lines

> **A `!!block` whose body is terminated by a blank line is highlighted
> incorrectly under Shiki: the block does not end, and the rest of the document
> is rendered as block content.**

This is a bug in Shiki itself, not in the grammar, and it affects every
Shiki-based highlighter regardless of theme or engine option. The same grammar
is correct in VS Code and in any consumer built on `vscode-textmate`.

**Why.** Shiki's per-line loop in `@shikijs/primitive` skips empty lines
outright:

```js
if (line === "") {
    actual = [];
    final.push([]);
    continue;          // grammar.tokenizeLine() is never called
}
```

Because the grammar is never invoked for a blank line, grammar state cannot
change there. Any TextMate `begin`/`end` rule whose terminator matches an empty
line can never fire, so the region survives the blank line and runs on. This is
not specific to `ddot.it` — heredocs, indented blocks and reStructuredText-style
constructs hit the same wall. Minimal reproduction, no `ddot.it` involved:

```js
// grammar
{ begin: "^START$", end: "^[ \t]*$", contentName: "string.body" }
// input:  "START\nin1\n\nOUT"
// expected: OUT is outside the region.   actual (Shiki): OUT is inside it.
```

Confirmed against shiki 4.1.0 / `@shikijs/primitive` 4.1.0. Patching that guard
to advance state across empty lines makes the case pass with the grammar
unchanged, which is what pins the cause.

**What this does *not* affect.** Only the blank-line form. Everything else —
triples, metadata, `,,` blocks, `off`/`on` spans — is unaffected, and so is the
explicit-terminator form of the same construct:

```
john ..address.. !!block?end=END
1 Broad Way

still inside the block: a blank line does not end this form
END
```

Because `END` is a real marker line rather than a blank one, Shiki handles it
correctly. **Prefer `!!block?end=MARKER` in content you intend to render with
Shiki.**

Tracked in this repo as a waived conformance case (`17-block`) in
`tools/conformance-shiki.mjs`, which carries the full analysis. The waiver is
self-expiring: if a future Shiki release fixes the loop, the case starts passing
and the harness fails until the waiver is removed.

## License

MIT
