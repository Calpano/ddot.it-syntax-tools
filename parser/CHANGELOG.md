# Changelog

## 0.1.1

Asserted against all 42 cases of the cross-implementation corpus.

### Changed

- **Events always carry the relation.** `parseEvents` / `toJsonl` wrote no
  `type` for an untyped `....` link and left consumers to default the missing
  field to `links to`. The relation is now filled in by the parser, also for the
  `,, .... value` metadata shortcut, and `toJsonl` always writes it.
- **`!!!block` is plain text**: the tokenizer gained the lookarounds that make
  `!!` a run of exactly two, as in the other implementations.

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

## 0.1.0

Initial release.

- `tokenize` / `toJson` — the canonical highlighter token stream.
- `parseEvents` / `toJsonl` — triple events, folded from those tokens rather
  than parsed separately, so the two cannot drift.
- `indexToDdot` and the `ddot-index` CLI — index a file to `.ddot` triple lines.

Both streams are asserted against all cases of the cross-implementation corpus
by `npm run conformance:parser`.
