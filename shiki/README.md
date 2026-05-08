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

| Scope                               | What                            |
|-------------------------------------|---------------------------------|
| `entity.name.subject.ddot`          | First slot of a triple          |
| `entity.name.relation.ddot`         | Predicate slot of a typed triple|
| `entity.name.object.ddot`           | Object slot                     |
| `entity.name.operator.ddot`         | `..` / `....` separator         |
| `keyword.control.ddot`              | `ddot.it…`, `!!…` commands      |
| `comment.metadata.*.ddot`           | `,,`-bounded metadata internals |
| `comment.block.disabled.ddot`       | `off`–`on` muted span           |

For the canonical token vocabulary and conformance protocol see
[`ddot.it/test-data/tokens.md`](https://github.com/Calpano/ddot.it/blob/main/test-data/tokens.md).

## License

MIT
