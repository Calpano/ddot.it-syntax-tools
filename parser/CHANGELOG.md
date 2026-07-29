# Changelog

## 0.1.0

Initial release.

- `tokenize` / `toJson` — the canonical highlighter token stream.
- `parseEvents` / `toJsonl` — triple events, folded from those tokens rather
  than parsed separately, so the two cannot drift.
- `indexToDdot` and the `ddot-index` CLI — index a file to `.ddot` triple lines.

Both streams are asserted against all cases of the cross-implementation corpus
by `npm run conformance:parser`.
