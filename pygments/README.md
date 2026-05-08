# pygments-ddot

[Pygments](https://pygments.org) lexer for **ddot.it** — a minimal text
format for typed knowledge graphs.

## Install

```sh
pip install pygments-ddot
```

The package registers itself via the `pygments.lexers` entry point, so
both `pygmentize` and any tool that uses `pygments.lexers.get_lexer_by_name`
will pick up `ddot` automatically.

## Use

### From the command line

```sh
pygmentize -l ddot -f html sample.ddot > sample.html
pygmentize -l ddot -f terminal sample.ddot
```

### From Python

```python
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import HtmlFormatter

code = open("sample.ddot").read()
lexer = get_lexer_by_name("ddot")
print(highlight(code, lexer, HtmlFormatter()))
```

Aliases registered: `ddot.it`, `ddot`, `ddotit`. File pattern: `*.ddot`.

## Token mapping

The lexer emits Pygments tokens chosen to map cleanly onto the canonical
token vocabulary at
[`ddot.it/test-data/tokens.md`](https://github.com/Calpano/ddot.it/blob/main/test-data/tokens.md).

| Pygments token              | Canonical name |
|-----------------------------|----------------|
| `Name.Class`                | `subject`      |
| `Name.Function`             | `relation`     |
| `Literal.String.Symbol`     | `object`       |
| `Operator`                  | `operator`     |
| `Keyword.Pseudo`            | `command`      |
| `Comment.Preproc`           | `meta-delim`   |
| `Comment.Special.Operator`  | `meta-operator`|
| `Comment.Special.Relation`  | `meta-relation`|
| `Comment.Special.Object`    | `meta-object`  |
| `Comment.Multiline`         | `meta-text`    |
| `Comment.Single`            | `disabled`     |

## Conformance

The lexer is verified against the cross-implementation golden corpus —
identical to the TextMate, Shiki, and Rouge ports. See
[`tools/conformance-pygments.py`](https://github.com/Calpano/ddot.it-syntax-tools/blob/main/tools/conformance-pygments.py).

## License

MIT
