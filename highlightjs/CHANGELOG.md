# Changelog

## 0.2.0

Rewritten to follow the ddot.it Parse and Highlight specifications, with the
TextMate grammar canonical. 0.1.1 was checked against the 11 corpus cases of
May 2026; 0.2.0 passes all 42.

### Breaking: scope names

The scopes follow the canonical token names. Theme CSS for the old names needs
updating:

| 0.1.1             | 0.2.0                |
|-------------------|----------------------|
| `hljs-operator`   | `hljs-doubledot`     |
| `hljs-meta-operator` | `hljs-meta-doubledot` |
| `hljs-disabled`   | `hljs-excluded`      |
| —                 | `hljs-meta-separator` (`;;`) |
| —                 | `hljs-verbatim` (block body) |
| —                 | `hljs-command-param` |
| —                 | `hljs-block-end`     |

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

First release published via OIDC trusted publishing. No functional
changes vs 0.1.0.

## 0.1.0

Initial release. highlight.js language definition for ddot.it. See
[`design.adoc`](./design.adoc).
