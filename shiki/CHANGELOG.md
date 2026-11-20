# Changelog

## 0.1.2

### Added

- **`ddotBlankLines` transformer and `fillBlankLines(code)`.** Shiki never
  passes an empty line to the grammar, so a `!!block` ended by a blank line ran
  on to the end of the document. The transformer replaces empty lines with a
  single space, which ends the block and does reach the grammar. Pass it in
  `transformers`; with `codeToTokens`, which does not run transformers, call
  `fillBlankLines` first. All 42 corpus cases now pass under Shiki, including
  the six that needed a waiver before (17, 29, 30, 32, 33, 34).

## 0.1.1

First release published via OIDC trusted publishing. Picks up
`@calpano/ddot-textmate-grammar` 0.1.1 (the canonical grammar
hasn't changed; both packages bumped together). No functional
changes vs 0.1.0.

## 0.1.0

Initial release. Shiki language registration that wraps
`@calpano/ddot-textmate-grammar`. See [`design.adoc`](./design.adoc).
