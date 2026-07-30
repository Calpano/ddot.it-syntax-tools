# Changelog

## 0.1.2

Restructured to match the ddot.it Highlight and Parse specifications. Every
rule in the repository was replaced, so this is effectively a new grammar
sharing only `scopeName: source.ddot` with 0.1.1.

### Added

- **`!!block` bodies.** A block opener must be the *last* thing on its line,
  and the body runs until the closing marker. Blocks are recognised in each
  position that admits one — subject (`block-subject`, `block-subject-marked`),
  object (`block-verbatim`, `block-verbatim-marked`) and meta object
  (`block-metaobject`, `block-metaobject-marked`) — with the marked variants
  covering the explicitly terminated form.
- **Block continuation.** After a block subject a `..`/`....` continues the
  triple, after a block object a `,,` opens metadata, and after a block meta
  object a `;;` continues it (`meta-continuation-line`).
- **Metadata as its own family**, split by where it occurs rather than one
  uniform rule: `meta-block-after-triple`, `meta-block-standalone`,
  `meta-block-triple-line`, `meta-block-text-line`, and the inline forms
  `meta-inline-triple`, `meta-inline-separator`, `meta-inline-text`.
- **`#excluded`** replaces `#disabled` for `ddot.it/off` … `ddot.it/on` and the
  `!!off` / `!!on` shorthand, which are now recognised anywhere on a line.

### Changed

- Token runs match a run of **exactly** *n* characters, enforced with
  lookarounds. Previously `\.{2}` could match the first two dots of `...`,
  which the tokenization rule forbids.
- `patterns` order is load-bearing and now documented in the grammar itself:
  first match wins, most specific first.

### Why now

0.1.1 has been the published grammar while all of the above accumulated
unreleased in this repository. Consumers installing from npm — including the
VS Code extension, which bundles whatever `install-grammar` resolves — were
getting 0.1.1 and therefore highlighting that disagreed with the
conformance corpus. Verified against all 33 cases in
`ddot.it/test-data/cases/`.

## 0.1.1

First release published via OIDC trusted publishing
(`Calpano/ddot.it-syntax-tools` → npm). No functional changes vs 0.1.0.

## 0.1.0

Initial release. Canonical TextMate grammar for ddot.it. See
[`design.adoc`](./design.adoc) for the framework-specific quirks
that drove the lexer's structure.
