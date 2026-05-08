"""Pygments lexer for ddot.it (https://ddot.it).

Emits Pygments tokens that — after the canonical-name mapping in
`tools/conformance-pygments.py` — equal the canonical token streams in
`../../ddot.it/test-data/cases/*/expected.tokens.json`.

Token mapping (Pygments → canonical, see ../../ddot.it/test-data/tokens.md):
  Name.Class                     → subject
  Name.Function                  → relation
  Literal.String.Symbol          → object
  Operator                       → operator
  Keyword.Pseudo                 → command
  Comment.Preproc                → meta-delim
  Comment.Special.Operator       → meta-operator
  Comment.Special.Relation       → meta-relation
  Comment.Special.Object         → meta-object
  Comment.Multiline              → meta-text
  Comment.Single                 → disabled
"""

from .lexer import DdotLexer

__all__ = ["DdotLexer"]
