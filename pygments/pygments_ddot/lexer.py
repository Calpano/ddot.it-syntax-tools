"""ddot.it Pygments lexer — port of the Rouge lexer in
`../../rouge/lib/rouge/lexers/ddot.rb`. Both share the same flat state machine:
every state ends a line by returning to `root`, so each `\\n` resets dispatch.

`ExtendedRegexLexer` rather than plain `RegexLexer`: a `!!block?end=MARKER`
region terminates on a line whose text equals a marker captured *earlier*, which
no static regex can express. Callbacks here receive a `LexerContext` and can pop
the state stack themselves, which is what makes the dynamic terminator possible.
"""

import re

# WS := TAB + every Unicode space separator (category Zs) — Parse Spec
# "what counts as WS". NBSP (U+00A0) & co. are visually identical to a space,
# so a slot must never keep one. Python's re has no \p{Zs}, hence the explicit
# class; the negated \s classes below already cover Zs, since Python 3 str
# patterns make \s Unicode-aware.

from pygments.lexer import ExtendedRegexLexer, bygroups
from pygments.token import (
    Comment,
    Keyword,
    Literal,
    Name,
    Operator,
    Punctuation,
    Text,
)

# --- lexical tokens (see the Parse Spec's "Token Sequences") ----------------
# Runs of EXACTLY n, neither preceded nor followed by the same character. The
# lookarounds are the whole point: `\.{2}` alone matches the first two dots of
# `...`, which the tokenization rule forbids.
DT2 = r"(?<!\.)\.{2}(?!\.)"
DT4 = r"(?<!\.)\.{4}(?!\.)"
QUAD = r"(?<!\.)(?:\.{4}|\.{2}[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+\.{2})(?!\.)"
CM2 = r"(?<!,),,(?!,)"
SC2 = r"(?<!;);;(?!;)"

OFF_RE = r"(?:ddot\.it/off|!!off)"
ON_RE = r"(?:ddot\.it/on|!!on)"
# A command needs the slash and a non-empty name; bare `ddot.it` is not one.
CMD_RE = r"(?:(?:https?://)?ddot\.it/|!!)[^\s?#]+(?:\?[^\s#]*)?(?:\#\S*)?"
BLOCK_RE = r"(?:(?:https?://)?ddot\.it/|!!)block"

# The line-shape gate: a line is ddot.it only when it carries a full operator
# skeleton — two DT2, or one DT4 / '.. ..'. A lone `..` in prose does not
# qualify, which is what keeps 23-not-a-triple entirely plain.
GATE = r"(?=[^\n]*(?:" + DT4 + r"|" + DT2 + r"[^\n]*" + DT2 + r"))"

# `!!block` filling a whole field: it must END its physical line.
BLOCK_OPENER = r"([\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)(" + BLOCK_RE + r")(?:(\?end=)(\S+))?([\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)(?=\n|\Z)"

_CMD_ONLY = re.compile(r"\A" + CMD_RE + r"\Z")


def _slot(slot_token):
    """Emit a slot as `slot_token`, unless its text is exactly a command — then
    it is a command (tokens.md: "a slot whose text is a command is emitted as
    command, not subject")."""

    def callback(lexer, match, ctx):
        text = match.group(0)
        tok = Keyword.Pseudo if _CMD_ONLY.match(text) else slot_token
        yield match.start(), tok, text
        ctx.pos = match.end()

    return callback


def _open_block(lexer, match, ctx):
    """A `!!block` opener: emit its parts, remember any ?end= marker, and enter
    the verbatim state."""
    lead, cmd, query, marker, trail = match.groups()
    pos = match.start()
    if lead:
        yield pos, Text, lead
        pos += len(lead)
    yield pos, Keyword.Pseudo, cmd
    pos += len(cmd)
    if query:
        yield pos, Name.Attribute, query
        pos += len(query)
        yield pos, Name.Label, marker
        pos += len(marker)
        lexer.block_end = marker
    else:
        lexer.block_end = None
    if trail:
        yield pos, Text, trail
    ctx.pos = match.end()
    # Replace the stack rather than pushing: the block ENDS the logical line, so
    # popping must land back in `root`, not in the slot state that opened it
    # (Rouge does the same with `goto`). Pushing would resume `object` after the
    # block and swallow the next line.
    ctx.stack[:] = ["root", "verbatim"]


def _verbatim_line(lexer, match, ctx):
    """A line inside a block body. In the marked form a line equal to the marker
    closes the block; otherwise every line is verbatim."""
    text = match.group(0)
    if lexer.block_end is not None and text.strip() == lexer.block_end:
        yield match.start(), Name.Label, text
        lexer.block_end = None
        ctx.stack.pop()
    else:
        yield match.start(), Literal.String.Backtick, text
    ctx.pos = match.end()


def _verbatim_blank(lexer, match, ctx):
    """A blank line ends the unmarked form; inside a marked block it is content.

    The rule consumes the trailing newline: a zero-width match here would never
    advance `ctx.pos` in the marked case (which does not pop), looping forever.
    """
    yield match.start(), Text, match.group(0)
    ctx.pos = match.end()
    if lexer.block_end is None:
        ctx.stack.pop()


class DdotLexer(ExtendedRegexLexer):
    name = "ddot.it"
    aliases = ["ddot.it", "ddot", "ddotit"]
    filenames = ["*.ddot"]
    mimetypes = ["text/x-ddot"]

    def __init__(self, **options):
        super().__init__(**options)
        self.block_end = None

    def get_tokens_unprocessed(self, text=None, context=None):
        self.block_end = None
        yield from super().get_tokens_unprocessed(text, context)

    tokens = {
        # ─────────── line-dispatch root ───────────
        "root": [
            # Standalone `,,` opens a free-form meta block.
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + CM2 + r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?=\n|\Z)", Comment.Preproc, "meta_block"),
            # Parse Spec "block-continuation": after a block that filled the
            # OBJECT, a line whose first token is CM2 CONTINUES the logical line
            # as metadata; without this it lexes as a fresh triple with subject
            # ",,". Keyed on shape, since a per-line state machine cannot see
            # that a block object preceded: ",," then whitespace then "..".
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(" + CM2 + r")(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+" + DT2 + r")",
             bygroups(Comment.Preproc), "inline_meta"),
            # ... and SC2 after a block META OBJECT (`;; ..until.. 2020`).
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(" + SC2 + r")(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+" + DT2 + r")",
             bygroups(Punctuation), "inline_meta"),
            # Off marker enters an excluded span.
            # Recognised ANYWHERE on the line (host-language comments); the whole line
            # is consumed, but only the command itself is coloured.
            (r"^([^\n]*?)(" + OFF_RE + r")(?![^\s?#])([^\n]*)(?=\n|\Z)",
             bygroups(Text, Keyword.Pseudo, Text), "disabled"),
            # `!!block` alone on a line = a SUBJECT opener (block-as-field).
            (r"^" + BLOCK_OPENER, _open_block),
            # Empty / whitespace-only line.
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*\n", Text),
            # Gate: only lines with a full operator skeleton parse as triples.
            (r"^" + GATE + r"(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?:" + DT2 + r"|" + QUAD + r"))", Text, "after_subject"),
            (r"^" + GATE, Text, "subject"),
            # Anything else is not a triple: consume the line, emit no token.
            (r"[^\n]+", Text),
            (r"\n", Text),
        ],

        # ─────────── verbatim (a !!block body) ───────────
        "verbatim": [
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*\n", _verbatim_blank),
            (r"^[^\n]+", _verbatim_line),
            (r"\n", Text),
        ],

        # ─────────── excluded span ───────────
        "disabled": [
            (r"^([^\n]*?)(" + ON_RE + r")(?![^\s?#])([^\n]*)(?=\n|\Z)",
             bygroups(Text, Keyword.Pseudo, Text), "#pop"),
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*\n", Text),
            (r"[^\n]+", Comment.Single),
            (r"\n", Text),
        ],

        # ─────────── multi-line meta block (free-form or typed) ───────────
        "meta_block": [
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + CM2 + r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?=\n|\Z)", Comment.Preproc, "#pop"),
            (r"^[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*\n", Text),
            (r"^(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?:" + DT2 + r"|" + QUAD + r"))", Text, "typed_meta_op"),
            (r"[^\n]+", Comment.Multiline),  # free-form meta text
            (r"\n", Text),
        ],

        # ─────────── triple line: subject phase ───────────
        "subject": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (r"[^\s.,][^\n,]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?:" + DT2 + r"|" + QUAD + r")|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + CM2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Name.Class), ("#pop", "after_subject")),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── after subject (or continuation-line entry) ───────────
        "after_subject": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            # QuadDot FIRST: '.. ..' is ONE operator, not two.
            (QUAD, Operator, ("#pop", "object")),
            (DT2, Operator, ("#pop", "relation")),
            (CM2, Comment.Preproc, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── relation phase ───────────
        "relation": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (r"[^\s.,][^\n.,]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + DT2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Name.Function), ("#pop", "after_relation")),
            (r"\n", Text, "#pop"),
        ],

        "after_relation": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (DT2, Operator, ("#pop", "object")),
            (CM2, Comment.Preproc, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── object phase ───────────
        # Object := TextExcept{NL,CM2} — it MAY contain `..` (20-object-dotdot),
        # so it runs to end of line or to a `,,`; it does not stop at a DT2.
        "object": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (BLOCK_OPENER, _open_block),
            (r"[^\s,][^\n,]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + CM2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Literal.String.Symbol), ("#pop", "after_object")),
            (r"\n", Text, "#pop"),
        ],

        "after_object": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            # Trailing `,,` at end of line opens a multi-line meta block.
            (CM2 + r"(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?:\n|\Z))", Comment.Preproc, ("#pop", "meta_block_open")),
            (CM2, Comment.Preproc, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],

        "meta_block_open": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (r"\n", Text, ("#pop", "meta_block")),
        ],

        # ─────────── typed meta inside a ,, block ───────────
        "typed_meta_op": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (QUAD, Comment.Special.Operator, ("#pop", "typed_meta_object")),
            (DT2, Comment.Special.Operator, ("#pop", "typed_meta_relation")),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_relation": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (r"[^\s.,][^\n.,]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + DT2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Comment.Special.Relation), ("#pop", "typed_meta_after_relation")),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_after_relation": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (DT2, Comment.Special.Operator, ("#pop", "typed_meta_object")),
            (r"\n", Text, "#pop"),
        ],

        # MetaObjectInBlock := TextExcept{NL} — `;;` is CONTENT here, not a
        # separator (that is the inline form only). See 28-semicolon-in-meta-block.
        "typed_meta_object": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (BLOCK_OPENER, _open_block),
            (r"[^\s][^\n]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Comment.Special.Object), ("#pop", "typed_meta_after_object")),
            (r"\n", Text, "#pop"),
        ],

        "typed_meta_after_object": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (r"\n", Text, "#pop"),
        ],

        # ─────────── inline metadata (after `,,` on a triple line) ───────────
        "inline_meta": [
            # A COMPLETE `..rel.. value` right after the `,,` selects the pair form.
            # A lone `..` before the entry ends (at `;;` or EOL) is not an operator,
            # it is literal meta text (41-inline-meta-unclosed-pair). The inner class
            # excludes SC2 so this cannot borrow the `..` of the NEXT entry.
            (r"(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*(?:" + QUAD + r"|" + DT2 + r"(?:(?!" + DT2 + r")(?!" + SC2 + r")[^\n])*?" + DT2 + r"))", Text, ("#pop", "inline_meta_op")),
            # An entry may be EMPTY and still be separated: `,, ;; a note`, and a
            # trailing `,, ;;` (40-inline-meta-empty-entry). `;;` separates
            # unconditionally, so it is a separator here too, not meta text.
            (SC2, Punctuation),
            # …a `!!block` that fills the whole meta-text position opens a
            # verbatim body (block-as-field, 4th position). Must precede the
            # free-text rule, which would otherwise swallow the opener as meta
            # text.
            (BLOCK_OPENER, _open_block),
            # …anything else is free-form meta text, trimmed of surrounding WS.
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            # MetaTextInline := TextExcept{NL,SC2}: the note ENDS at the next `;;`,
            # exactly as a pair's object does -- `;;` separates entries unconditionally
            # (36-inline-meta-notes, 37-inline-meta-mixed).
            (r"(?!" + SC2 + r")[^\s](?:(?!" + SC2 + r")[^\n])*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + SC2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             Comment.Multiline, ("#pop", "inline_meta_next")),
            (r"\n", Text, "#pop"),
        ],

        "inline_meta_op": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (QUAD, Comment.Special.Operator, ("#pop", "inline_meta_object")),
            (DT2, Comment.Special.Operator, ("#pop", "inline_meta_relation")),
            (r"\n", Text, "#pop"),
        ],

        "inline_meta_relation": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (r"[^\s.,][^\n.,]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + DT2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Comment.Special.Relation), ("#pop", "inline_meta_after_relation")),
            (r"\n", Text, "#pop"),
        ],

        "inline_meta_after_relation": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (DT2, Comment.Special.Operator, ("#pop", "inline_meta_object")),
            (r"\n", Text, "#pop"),
        ],

        # MetaObjectInline := TextExcept{NL,SC2} — stops at `;;`.
        "inline_meta_object": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            (BLOCK_OPENER, _open_block),
            (r"[^\s;][^\n;]*?(?=[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*" + SC2 + r"|[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*$|\n|\Z)",
             _slot(Comment.Special.Object), ("#pop", "inline_meta_next")),
            (r"\n", Text, "#pop"),
        ],

        # `;;` divides the ENTRIES of one triple's inline meta.
        "inline_meta_next": [
            (r"[\t\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+", Text),
            # The next entry may be a pair OR a free-text note, so return to the
            # "inline_meta" dispatcher -- "inline_meta_op" accepts only the dotted forms.
            (SC2, Punctuation, ("#pop", "inline_meta")),
            (r"\n", Text, "#pop"),
        ],
    }
