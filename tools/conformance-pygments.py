#!/usr/bin/env python3
"""Pygments conformance: tokenize each ../ddot.it/test-data/cases/*/input.ddot
with the Pygments lexer in `../pygments/pygments_ddot/` and assert byte
equality of the canonical-mapped token stream against `expected.tokens.json`.

  python3 tools/conformance-pygments.py
  npm run conformance:pygments

Reports per-case pass/fail. Exits non-zero if any case diverges.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
REPO = HERE.parent
sys.path.insert(0, str(REPO / "pygments"))

from pygments.token import (  # noqa: E402  (sys.path mutation above)
    Comment,
    Keyword,
    Literal,
    Name,
    Operator,
)
from pygments_ddot import DdotLexer  # noqa: E402

CASES = (REPO.parent / "ddot.it" / "test-data" / "cases").resolve()

# Pygments token → canonical token name (see test-data/tokens.md).
TOKEN_TO_CANONICAL = {
    Name.Class:                    "subject",
    Name.Function:                 "relation",
    Literal.String.Symbol:         "object",
    Operator:                      "operator",
    Keyword.Pseudo:                "command",
    Comment.Preproc:               "meta-delim",
    Comment.Special.Operator:      "meta-operator",
    Comment.Special.Relation:      "meta-relation",
    Comment.Special.Object:        "meta-object",
    Comment.Multiline:             "meta-text",
    Comment.Single:                "disabled",
}


def tokenize_canonical(src: str) -> list[dict]:
    """Tokenize via Pygments and emit canonical-shape entries, dropping
    whitespace-only chunks the way the other conformance harnesses do."""
    lexer = DdotLexer()
    out: list[dict] = []
    line = 0
    col = 0
    for tok_type, value in lexer.get_tokens(src):
        if not value:
            continue
        # Split at newlines; each non-newline chunk emits if classified.
        i = 0
        while i < len(value):
            nl = value.find("\n", i)
            if nl == -1:
                chunk = value[i:]
                if chunk:
                    canonical = TOKEN_TO_CANONICAL.get(tok_type)
                    if canonical and chunk.strip():
                        out.append({
                            "line": line,
                            "start": col,
                            "end": col + len(chunk),
                            "token": canonical,
                            "text": chunk,
                        })
                    col += len(chunk)
                break
            chunk = value[i:nl]
            if chunk:
                canonical = TOKEN_TO_CANONICAL.get(tok_type)
                if canonical and chunk.strip():
                    out.append({
                        "line": line,
                        "start": col,
                        "end": col + len(chunk),
                        "token": canonical,
                        "text": chunk,
                    })
            line += 1
            col = 0
            i = nl + 1
    return out


def diff_tokens(actual: list[dict], expected: list[dict]) -> list[str]:
    out: list[str] = []
    n = max(len(actual), len(expected))
    for i in range(n):
        a = actual[i] if i < len(actual) else None
        e = expected[i] if i < len(expected) else None
        if a == e:
            continue
        out.append(f"  #{i}")
        out.append(f"    expected: {json.dumps(e) if e else '(none)'}")
        out.append(f"    actual:   {json.dumps(a) if a else '(none)'}")
        if len(out) > 30:
            break
    return out


def main() -> int:
    if not CASES.is_dir():
        print(f"cases dir not found: {CASES}", file=sys.stderr)
        return 2

    failures = []
    case_dirs = sorted(d for d in CASES.iterdir() if d.is_dir())
    for case_dir in case_dirs:
        name = case_dir.name
        input_path = case_dir / "input.ddot"
        expected_path = case_dir / "expected.tokens.json"
        if not (input_path.is_file() and expected_path.is_file()):
            print(f"skip  {name}")
            continue
        expected = json.loads(expected_path.read_text())
        actual = tokenize_canonical(input_path.read_text())
        if actual == expected:
            print(f"ok    {name}")
        else:
            failures.append(name)
            print(f"FAIL  {name}")
            for line in diff_tokens(actual, expected):
                print(line)

    if failures:
        print(f"\n{len(failures)}/{len(case_dirs)} cases diverge: {', '.join(failures)}", file=sys.stderr)
        return 1
    print(f"\nall {len(case_dirs)} cases pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
