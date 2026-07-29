# Changelog

## 0.1.3

No lexer changes — token output is identical to 0.1.2.

### Added

- **`require 'rouge-ddot'` now works.** The gem shipped only
  `lib/rouge/lexers/ddot.rb`, so requiring it by gem *name* raised
  `LoadError: cannot load such file -- rouge-ddot`. Since Rouge does not
  auto-discover third-party lexers, and `Bundler.require` (Jekyll's
  `:jekyll_plugins` group, Rails initializers, …) requires gems by name,
  hosts could not load the lexer the conventional way: adding it to a
  `:jekyll_plugins` group *crashed the build*. Every host therefore had to
  know the internal path and write `require 'rouge/lexers/ddot'` into a plugin
  file of its own. A `lib/rouge-ddot.rb` entry point now requires the lexer,
  so this is enough to highlight `[source,ddot.it]` blocks in Jekyll:

  ```ruby
  # Gemfile
  group :jekyll_plugins do
    gem 'rouge-ddot', '~> 0.1.3'
  end
  ```

  `require 'rouge/lexers/ddot'` keeps working unchanged.

## 0.1.2

Brings the lexer in line with the ddot.it Parse and Highlight specifications.
Conformance is asserted against all 33 cases of the cross-implementation
corpus (`../ddot.it/test-data/cases/`), with the TextMate grammar canonical.

### Fixed

- **`FrozenError` on any block containing a non-triple line.** The file carried
  `# frozen_string_literal: true`, but Rouge mutates the string handed to
  `token`, so lexing a `!!block` body, an annotation line or an end marker
  raised `can't modify frozen String` (Rouge 4.7). This crashed Asciidoctor
  outright, making 0.1.1 unusable on real ddot.it documentation.
- **`Error` token on the blank line inside a `?end=` block.** The blank-line
  rule matched zero-width, so Rouge could not advance and emitted `Error` for
  the newline — an error-styled blank line in every marked block. The rule now
  consumes the newline. Invisible to the corpus, whose harness drops
  whitespace-only chunks; it showed only in rendered output.

### Added

- **`!!off` / `!!on` recognised anywhere on a line**, not only alone on one, so
  the commands work inside host-language comments (`<!-- ddot.it/off -->`,
  `# !!off`, `// !!on`). Only the command itself is coloured; the line yields no
  triple and the region starts on the next line. The command *name* is still
  matched exactly, so `!!office` is not `!!off`.
- **Metadata continuation after a block** (Parse Spec *block-continuation*): a
  line whose first token is `,,` continues the triple whose **object** a block
  filled, and `;;` continues after a block **meta object**. Previously both read
  as a fresh triple with the subject `,,` / `;;`, and the unmatched delimiter
  produced an `Error` token.
- **Continuation lines that open a block** (`..knows.. !!block`), so one logical
  line can carry a block subject *and* a block object.

### Changed

- **Canonical token names** (`test-data/tokens.md`), which changes the emitted
  Rouge token types:

  | ddot.it token   | 0.1.1                | 0.1.2                       |
  |-----------------|----------------------|-----------------------------|
  | `doubledot`     | `Operator` → *operator* | `Operator`               |
  | `meta-doubledot`| `Comment::Hashbang` → *meta-operator* | `Comment::Hashbang` |
  | `excluded`      | `Comment::Single` → *disabled* | `Comment::Single`  |
  | `meta-separator`| —                    | `Punctuation`               |
  | `command-param` | —                    | `Name::Attribute`           |
  | `block-end`     | —                    | `Name::Label`               |
  | `verbatim`      | —                    | `Literal::String::Backtick` |

  Themes that styled `operator`, `meta-operator` or `disabled` by *name* need
  updating; those styling by Rouge token class are unaffected except for the
  four newly emitted classes.
- **Lexical tokens follow the spec's counting rule.** `DT2`/`DT4`/`CM2`/`SC2`
  are runs of *exactly* n, expressed with lookarounds, so `...` and `......`
  are text rather than operators.
- **The line-shape gate.** A line is ddot.it only when it carries a complete
  operator skeleton — two `DT2`, or one `DT4` / `.. ..`. Prose with a lone `..`,
  an ellipsis, `Node.js` or `U.S.A.` stays plain.
- **Commands require the slash and a name**: bare `ddot.it` is a document
  marker, not a command, and `?`/`#` introduce a command's query and fragment
  instead of terminating it (`!!block?end=EOS` is one command).
- **`!!block` as a field value** in the Subject, Object and MetaObject
  positions, blank-line and `?end=MARKER` terminated, with the body emitted as
  `verbatim`.
- **`;;` separates inline metadata pairs only.** Inside a `,,` block a metadata
  object runs to the end of its line, so `;;` there is ordinary text.

## 0.1.1

First release published via OIDC trusted publishing
(`Calpano/ddot.it-syntax-tools` → RubyGems). No functional
changes vs 0.1.0.

## 0.1.0

Initial release. Rouge lexer for ddot.it. See
[`design.adoc`](./design.adoc).
