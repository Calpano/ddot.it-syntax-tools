# chroma/ddot.xml

[Chroma](https://github.com/alecthomas/chroma) lexer for **ddot.it** — a
minimal text format for typed knowledge graphs.

Chroma reads its lexers as XML files; this directory ships one
(`ddot.xml`) that produces tokens equivalent to the canonical token
stream defined at
[`ddot.it/test-data/tokens.md`](https://github.com/Calpano/ddot.it/blob/main/test-data/tokens.md).

## Use

### Programmatically (Go)

```go
import (
    "io/fs"
    "embed"
    "github.com/alecthomas/chroma/v2"
)

//go:embed ddot.xml
var ddotFS embed.FS

lexer, err := chroma.NewXMLLexer(ddotFS, "ddot.xml")
if err != nil { panic(err) }

iter, err := lexer.Tokenise(nil, source)
for tok := iter(); tok != chroma.EOF; tok = iter() {
    // tok.Type, tok.Value
}
```

### Via the `chroma` CLI

Drop `ddot.xml` into Chroma's `lexers/embedded/` directory in a fork (or
register at runtime via your own binary), then:

```sh
chroma -l ddot.it sample.ddot
```

## Token mapping

| Chroma token            | Canonical name |
|-------------------------|----------------|
| `NameClass`             | `subject`      |
| `NameFunction`          | `relation`     |
| `LiteralStringSymbol`   | `object`       |
| `Operator`              | `operator`     |
| `KeywordPseudo`         | `command`      |
| `CommentPreproc`        | `meta-delim`   |
| `CommentHashbang`       | `meta-operator`|
| `NameAttribute`         | `meta-relation`|
| `LiteralStringHeredoc`  | `meta-object`  |
| `CommentMultiline`      | `meta-text`    |
| `CommentSingle`         | `disabled`     |

## Implementation note

Chroma allows only one mutator per rule, so this XML uses **push-only**
state transitions and **cascading lookahead-pop on `\n`**: each non-root
phase state has a `(?=\n)` rule that pops one, and the pops chain until
control is back in `root`, which then consumes the literal newline. The
sibling Pygments and Rouge ports use the more direct pop+push (goto)
pattern instead.

## Conformance

Verified against the cross-implementation golden corpus. See
[`tools/conformance-chroma/`](https://github.com/Calpano/ddot.it-syntax-tools/tree/main/tools/conformance-chroma)
— the harness runs inside `golang:1.23` so no Go toolchain is needed on
the host.

```sh
npm run conformance:chroma
```

## License

MIT
