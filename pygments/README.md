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
| `Operator`                  | `doubledot`    |
| `Keyword.Pseudo`            | `command`      |
| `Name.Attribute`            | `command-param`|
| `Comment.Preproc`           | `meta-delim`   |
| `Punctuation`               | `meta-separator`|
| `Comment.Special.Operator`  | `meta-doubledot`|
| `Comment.Special.Relation`  | `meta-relation`|
| `Comment.Special.Object`    | `meta-object`  |
| `Comment.Multiline`         | `meta-text`    |
| `Literal.String.Backtick`   | `verbatim`     |
| `Name.Label`                | `block-end`    |
| `Comment.Single`            | `excluded`     |

## Conformance

The lexer is verified against the cross-implementation golden corpus —
identical to the TextMate, Shiki, and Rouge ports. See
[`tools/conformance-pygments.py`](https://github.com/Calpano/ddot.it-syntax-tools/blob/main/tools/conformance-pygments.py).

```sh
npm run conformance:pygments      # or: python3 tools/conformance-pygments.py
```

### Prerequisite: Pygments itself must be importable

The harness imports the lexer straight from this directory — it does **not**
need `pygments-ddot` installed — but it does need the real
[Pygments](https://pypi.org/project/Pygments/) library available to whichever
`python3` is on `PATH`. macOS system Python does not ship it.

From the **repository root** (where `package.json` lives; `.venv/` is
gitignored):

```sh
python3 -m venv .venv && .venv/bin/pip install pygments
PATH="$PWD/.venv/bin:$PATH" npm run conformance:pygments
```

### If it fails with `No module named 'pygments'`

That error is misleading, and it does not mean the import path is wrong.
`conformance-pygments.py` puts this repo's `pygments/` directory on
`sys.path` so it can `import pygments_ddot`. Because that directory is itself
named `pygments`, Python registers it as a *namespace package* called
`pygments` — which shadows the real library's name.

When the real Pygments **is** installed it wins, because a regular package
(one with `__init__.py`) takes precedence over a namespace portion. When it is
**not** installed, only the empty namespace portion remains, so `import
pygments` succeeds while `from pygments.token import ...` fails — hence an
error naming a module that appeared to import fine.

The fix is always to install Pygments, never to change `sys.path`.

The failure is loud: the script exits non-zero, so `npm run conformance`
stops at this mirror rather than skipping it. A conformance run that does not
mention Pygments has not verified it.

## License

MIT
