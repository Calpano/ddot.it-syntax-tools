# Changelog

## 0.1.2

Rewritten to follow the ddot.it Parse and Highlight specifications, with the
TextMate grammar canonical. 0.1.1 was checked against the 11 corpus cases of
May 2026; 0.1.2 passes all 42.

### Token types

The existing Pygments token types are unchanged, so styles keep working. Four
are new:

| Pygments token            | Canonical name   |
|---------------------------|------------------|
| `Punctuation`             | `meta-separator` (`;;`) |
| `Literal.String.Backtick` | `verbatim` (block body) |
| `Name.Attribute`          | `command-param`  |
| `Name.Label`              | `block-end`      |

The canonical names of three existing ones changed: `Operator` is `doubledot`
(was `operator`), `Comment.Special.Operator` is `meta-doubledot` (was
`meta-operator`), and `Comment.Single` is `excluded` (was `disabled`).

### Added

- **`!!block` values** in the subject, object and metadata-object positions,
  and after `,,`, ended by a blank line or by `?end=MARKER`. The body is
  `verbatim`, the end marker `block-end`.
- **Commands with query and fragment** (`!!block?end=EOS`); the part after the
  name is `command-param`.
- **`!!off` / `!!on` anywhere on a line**, so they work inside host-language
  comments such as `<!-- ddot.it/off -->`.
- **Continuation lines**: after a block object a line starting with `,,`
  continues the triple's metadata; after a block metadata object a line
  starting with `;;` does; and a continuation line can itself open a block
  (`..knows.. !!block`).

### Changed

- **Operators are runs of exactly n characters**, so `...` and `......` are
  text, and a line is ddot.it only when it has a complete operator skeleton:
  prose with a lone `..`, an ellipsis or `Node.js` stays plain.

- **Unicode whitespace.** Whitespace is `[\t\p{Zs}]`, so a no-break space
  (U+00A0) or any other space separator between slots separates exactly like a
  space. U+200B ZERO WIDTH SPACE is a format character (Cf), not a space
  separator, so it stays inside the name it is in (corpus case
  35-unicode-whitespace).
- **`,, !!block` opens a block.** The free metadata text after `,,` is the
  fourth position in which a `!!block` opener is recognised, after subject,
  object and metadata object (34-block-meta-text).
- **Inline metadata entries.** In `,,` inline metadata, `;;` always separates
  entries, and an entry is a relation/value pair only when it carries a complete
  `..relation.. value`; anything else is a note (36 to 42):
  - an empty entry is allowed: in `,, ;; a note` the `;;` is a separator, not
    unlexed text;
  - `,, ..bla` is a note, not the start of a pair whose relation is `bla`;
  - a pair's relation cannot run across a `;;`, so `,, ..bla ;; ..since.. 2016`
    is the note `..bla` and the pair `since`/`2016`, not the relation `bla ;;`.

## 0.1.1

First release published via OIDC trusted publishing
(`Calpano/ddot.it-syntax-tools` → PyPI). No functional changes
vs 0.1.0.

## 0.1.0

Initial release. Pygments lexer for ddot.it, registered via the
`pygments.lexers` entry point. See [`design.adoc`](./design.adoc).
