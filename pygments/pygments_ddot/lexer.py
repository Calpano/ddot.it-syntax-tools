"""ddot.it Pygments lexer — direct port of the Rouge lexer in
`../../rouge/lib/rouge/lexers/ddot.rb`. Both implementations share the same
flat state machine: every state ends a line by transitioning back to
`root`, so each `\\n` resets dispatch."""

from pygments.lexer import RegexLexer
from pygments.token import (
    Comment,
    Keyword,
    Literal,
    Name,
    Operator,
    Text,
)

OFF_RE = r"(?:ddot\.it/off|!!off)"
ON_RE = r"(?:ddot\.it/on|!!on)"
CMD_RE = r"(?:ddot\.it(?:/[\w.\-]+)?|!![\w.\-]*)"


class DdotLexer(RegexLexer):
    name = "ddot.it"
    aliases = ["ddot.it", "ddot", "ddotit"]
    filenames = ["*.ddot"]
    mimetypes = ["text/x-ddot"]

    tokens = {
        # ─────────── line-dispatch root ───────────
        "root": [
            # Standalone `,,` opens a free-form meta block.
            (r"^[ \t]*,,[ \t]*(?=\n|\Z)", Comment.Preproc, "meta_block"),
            # Off marker enters disabled span.
            (r"^[ \t]*" + OFF_RE + r"[ \t]*(?=\n|\Z)", Keyword.Pseudo, "disabled"),
            # Empty / whitespace-only line.
            (r"^[ \t]*\n", Text),
            # Continuation line (starts with `..` or `....`).
            (r"^(?=[ \t]*\.{2,4})", Text, "after_subject"),
            # Triple line — start with subject parsing.
            (r"^", Text, "subject"),
        ],

        # ─────────── disabled span ───────────
        "disabled": [
            (r"^[ \t]*" + ON_RE + r"[ \t]*(?=\n|\Z)", Keyword.Pseudo, "#pop"),
            (r"^[ \t]*\n", Text),
            (r"[^\n]+", Comment.Single),
            (r"\n", Text),
        ],

        # ─────────── multi-line meta block (free-form) ───────────
        "meta_block": [
            (r"^[ \t]*,,[ \t]*(?=\n|\Z)", Comment.Preproc, "#pop"),
            (r"^[ \t]*\n", Text),
            (r"[^\n]+", Comment.Multiline),
            (r"\n", Text),
        ],

        # ─────────── triple line: subject phase ───────────
        "subject": [
            (r"[ \t]+", Text),
            (
                CMD_RE + r"(?=[ \t]+\.{2,4}|[ \t]*,,|[ \t]*$|\n|\Z)",
                Keyword.Pseudo,
                ("#pop", "after_subject"),
            ),
            (
                r"[^\s.,][^\n,]*?(?=[ \t]+\.{2,4}|[ \t]*,,|[ \t]*$|\n|\Z)",
                Name.Class,
                ("#pop", "after_subject"),
            ),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── after subject (or continuation entry) ───────────
        "after_subject": [
            (r"[ \t]+", Text),
            # `.. ..` (spaced operator) — one token covering both dots+space,
            # matching the canonical corpus.
            (r"\.{2}[ \t]+\.{2}", Operator, ("#pop", "object")),
            (r"\.{4}", Operator, ("#pop", "object")),
            (r"\.{2}", Operator, ("#pop", "relation")),
            (r",,", Comment.Preproc, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── relation phase ───────────
        "relation": [
            (
                r"[^\s.,][^\n.,]*?(?=[ \t]*\.{2}|[ \t]*$|\n|\Z)",
                Name.Function,
                ("#pop", "after_relation"),
            ),
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],

        "after_relation": [
            (r"[ \t]+", Text),
            (r"\.{2}", Operator, ("#pop", "object")),
            (r",,", Comment.Preproc, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── object phase ───────────
        "object": [
            (
                r"[^\s,][^\n,]*?(?=[ \t]*,,|[ \t]*$|\n|\Z)",
                Literal.String.Symbol,
                ("#pop", "after_object"),
            ),
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],

        "after_object": [
            (r"[ \t]+", Text),
            # Trailing `,,` at end of line opens a typed multi-line meta block.
            (
                r",,(?=[ \t]*(?:\n|\Z))",
                Comment.Preproc,
                ("#pop", "typed_meta_open"),
            ),
            # Inline `,,` followed by content on the same line.
            (r",,", Comment.Preproc, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],

        # Right after trailing `,,` — wait for newline, then enter the block.
        "typed_meta_open": [
            (r"[ \t]+", Text),
            (r"\n", Text, ("#pop", "typed_meta_block")),
        ],

        # Typed meta block: each line is `..rel.. obj`, closed by standalone `,,`.
        "typed_meta_block": [
            (r"^[ \t]*,,[ \t]*(?=\n|\Z)", Comment.Preproc, "#pop"),
            (r"^[ \t]*\n", Text),
            (r"^(?=[ \t]*\.{2,4})", Text, "typed_meta_op1"),
            (r"[^\n]+", Comment.Multiline),
            (r"\n", Text),
        ],

        "typed_meta_op1": [
            (r"[ \t]+", Text),
            (r"\.{2}", Comment.Special.Operator, ("#pop", "typed_meta_relation")),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_relation": [
            (
                r"[^\s.,][^\n.,]*?(?=[ \t]*\.{2}|[ \t]*$|\n|\Z)",
                Comment.Special.Relation,
                ("#pop", "typed_meta_after_relation"),
            ),
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_after_relation": [
            (r"[ \t]+", Text),
            (r"\.{2}", Comment.Special.Operator, ("#pop", "typed_meta_object")),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_object": [
            (
                r"[^\s,][^\n,]*?(?=[ \t]*$|\n|\Z)",
                Comment.Special.Object,
                ("#pop", "typed_meta_after_object"),
            ),
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_after_object": [
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── inline metadata (after `,,` on a triple line) ───────────
        "inline_meta": [
            (r"[ \t]+", Text),
            (r"\.{2}", Comment.Special.Operator, ("#pop", "inline_meta_relation")),
            (r"\n", Text, "#pop"),
        ],

        "inline_meta_relation": [
            (
                r"[^\s.,][^\n.,]*?(?=[ \t]*\.{2}|[ \t]*$|\n|\Z)",
                Comment.Special.Relation,
                ("#pop", "inline_meta_after_relation"),
            ),
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],

        "inline_meta_after_relation": [
            (r"[ \t]+", Text),
            (r"\.{2}", Comment.Special.Operator, ("#pop", "inline_meta_object")),
            (r"\n", Text, "#pop"),
        ],

        "inline_meta_object": [
            (
                r"[^\s,][^\n,]*?(?=[ \t]*$|\n|\Z)",
                Comment.Special.Object,
                ("#pop", "after_object"),
            ),
            (r"[ \t]+", Text),
            (r"\n", Text, "#pop"),
        ],
    }
