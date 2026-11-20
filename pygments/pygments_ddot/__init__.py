"""Pygments lexer for ddot.it (https://ddot.it).

Emits Pygments tokens that — after the canonical-name mapping in
`tools/conformance-pygments.py` — equal the canonical token streams in
`../../ddot.it/test-data/cases/*/expected.tokens.json`.

Token mapping (Pygments → canonical, see ../../ddot.it/test-data/tokens.md):
  Name.Class                     → subject
  Name.Function                  → relation
  Literal.String.Symbol          → object
  Operator                       → doubledot
  Keyword.Pseudo                 → command
  Name.Attribute                 → command-param
  Comment.Preproc                → meta-delim
  Punctuation                    → meta-separator
  Comment.Special.Operator       → meta-doubledot
  Comment.Special.Relation       → meta-relation
  Comment.Special.Object         → meta-object
  Comment.Multiline              → meta-text
  Literal.String.Backtick        → verbatim
  Name.Label                     → block-end
  Comment.Single                 → excluded
"""

from .lexer import DdotLexer

__all__ = ["DdotLexer"]
