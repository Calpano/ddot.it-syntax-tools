# Rouge lexer for ddot.it (https://ddot.it). Emits tokens that — after the
# scope-name mapping in `tools/conformance-rouge.rb` — equal the canonical
# token streams in `../../ddot.it/test-data/cases/*/expected.tokens.json`.
#
# Token mapping (Rouge → canonical, see ../../../ddot.it/test-data/tokens.md):
#   Name::Class                  → subject
#   Name::Function               → relation
#   Literal::String::Symbol      → object
#   Operator                     → doubledot
#   Keyword::Pseudo              → command
#   Name::Attribute              → command-param
#   Name::Label                  → block-end
#   Comment::Preproc             → meta-delim
#   Punctuation                  → meta-separator
#   Comment::Hashbang            → meta-doubledot
#   Comment::Doc                 → meta-relation
#   Comment::Special             → meta-object
#   Comment::Multiline           → meta-text
#   Comment::Single              → excluded
#   Literal::String::Backtick    → verbatim
#
# NOT `# frozen_string_literal: true`: Rouge mutates the string handed to
# `token`, so a frozen literal raises FrozenError (observed with Rouge 4.7).
#
# State machine is flat by design: we use `goto` exclusively (no `push`), so
# the stack is always one deep and `\n` simply transitions back to `:root`.
#
# Rouge gotcha: `rule pat, Token do |m| ... end` IGNORES the Token arg when
# a block is given. To both emit a token AND transition, use a block that
# calls `token Token, m[0]` then `goto :next`.

require 'rouge'

module Rouge
  module Lexers
    class Ddot < RegexLexer
      title 'ddot.it'
      desc 'Knowledge graph notation (https://ddot.it)'
      tag 'ddot'
      aliases 'ddotit', 'ddot.it'
      filenames '*.ddot'
      mimetypes 'text/x-ddot'

      # --- lexical tokens (see the Parse Spec's "Token Sequences") ----------
      # Each is a run of EXACTLY n, neither preceded nor followed by the same
      # character — the lookarounds are what express that. `\.{2}` alone would
      # happily match the first two dots of `...`.
      DT2  = /(?<!\.)\.{2}(?!\.)/.freeze
      DT4  = /(?<!\.)\.{4}(?!\.)/.freeze
      QUAD = /(?<!\.)(?:\.{4}|\.{2}[ \t]+\.{2})(?!\.)/.freeze
      CM2  = /(?<!,),,(?!,)/.freeze
      SC2  = /(?<!;);;(?!;)/.freeze

      OFF_RE   = %r{(?:ddot\.it/off|!!off)}.freeze
      ON_RE    = %r{(?:ddot\.it/on|!!on)}.freeze
      # Pins the command NAME: `!!office` must not read as `!!off`.
      BOUND_SRC = /(?![^\s?#])/.freeze
      # A command needs the slash and a non-empty name; bare `ddot.it` is not one.
      CMD_RE   = %r{(?:(?:https?://)?ddot\.it/|!!)[^\s?#]+(?:\?[^\s#]*)?(?:\#\S*)?}.freeze
      BLOCK_RE = %r{(?:(?:https?://)?ddot\.it/|!!)block}.freeze

      # The line-shape gate: a line is ddot.it only if it carries a complete
      # operator skeleton — two DT2, or one DT4 / '.. ..'. A lone `..` in prose
      # does not qualify, which is what keeps 23-not-a-triple entirely plain.
      GATE = /(?=[^\n]*(?:#{DT4}|#{DT2}[^\n]*#{DT2}))/.freeze

      # `!!block` filling a whole field: it must END its physical line.
      BLOCK_OPENER = /#{BLOCK_RE}(?:(\?end=)(\S+))?[ \t]*(?=\n|\z)/.freeze

      def reset!
        super
        @block_end = nil
      end

      # Emit a slot's text as `slot_token`, unless it is exactly a command —
      # then it is a command (tokens.md: "a slot whose text is a command is
      # emitted as command, not subject").
      def slot(match, slot_token)
        text = match[0]
        token(text.match?(/\A#{CMD_RE}\z/) ? Keyword::Pseudo : slot_token, text)
      end

      # A `!!block` opener was matched: emit its parts, remember any ?end=
      # marker, and switch to verbatim.
      def open_block(match)
        raw  = match[0]
        lead = raw[/\A[ \t]*/]
        body = raw[lead.length..].rstrip
        tail = raw[(lead.length + body.length)..]
        token Text, lead unless lead.empty?
        if match[2]
          token Keyword::Pseudo, body[0...body.index('?end=')]
          token Name::Attribute, match[1]
          token Name::Label, match[2]
          @block_end = match[2]
        else
          token Keyword::Pseudo, body
          @block_end = nil
        end
        token Text, tail unless tail.nil? || tail.empty?
        goto :verbatim
      end

      # ─────────── line-dispatch root ───────────
      state :root do
        # Standalone ,, opens a free-form meta block.
        rule(%r/^[ \t]*#{CM2}[ \t]*(?=\n|\z)/) do |m|
          token Comment::Preproc, m[0]
          goto :meta_block
        end
        # Parse Spec "block-continuation": after a block that filled the OBJECT,
        # a line whose first token is CM2 CONTINUES the logical line as metadata
        # (and SC2 after a block meta object).
        # Without this it lexes as a fresh triple whose subject is ",," (or, in
        # this lexer, as an unmatched ",," followed by subject "since").
        # Keyed on shape — a state machine over physical lines cannot see that a
        # block object preceded: ",," then whitespace then "..".
        rule(%r/^[ \t]*(#{CM2})(?=[ \t]+#{DT2})/) do |m|
          token Comment::Preproc, m[1]
          push :inline_meta
        end
        # ... and SC2 after a block META OBJECT (`;; ..until.. 2020`).
        rule(%r/^[ \t]*(#{SC2})(?=[ \t]+#{DT2})/) do |m|
          token Punctuation, m[1]
          push :inline_meta
        end
        # Off-marker enters an excluded span.
        # Recognised ANYWHERE on the line (host-language comments), but the whole
        # line is consumed so only the command itself is coloured.
        rule(%r/^([^\n]*?)(#{OFF_RE}#{BOUND_SRC})([^\n]*)(?=\n|\z)/) do |m|
          token Text, m[1]
          token Keyword::Pseudo, m[2]
          token Text, m[3]
          goto :disabled
        end
        # `!!block` alone on a line = a SUBJECT opener (block-as-field).
        rule(%r/^[ \t]*#{BLOCK_OPENER}/) { |m| open_block(m) }
        # Empty / whitespace-only line.
        rule %r/^[ \t]*\n/, Text
        # Gate: only lines with a full operator skeleton parse as triples.
        rule(/^#{GATE}(?=[ \t]*(?:#{DT2}|#{QUAD}))/) { goto :after_subject }
        rule(/^#{GATE}/) { goto :subject }
        # Anything else is not a triple: consume the line, emit no token.
        rule %r/[^\n]+/, Text
        rule %r/\n/, Text
      end

      # ─────────── verbatim (a !!block body) ───────────
      state :verbatim do
        # A blank line ends the unmarked form; in a marked block it is content.
        # The newline MUST be consumed here: a zero-width match leaves the
        # stream where it was, Rouge cannot advance, and it emits Error for the
        # newline instead — visible as an error-styled blank line inside every
        # `?end=` block. (The conformance harness drops whitespace-only chunks,
        # so the corpus cannot catch this; it only shows in rendered output.)
        rule(%r/^[ \t]*\n/) do |m|
          token Text, m[0]
          goto :root if @block_end.nil?
        end
        rule(%r/^[ \t]*\z/) do |m|
          token Text, m[0]
          goto :root if @block_end.nil?
        end
        rule(%r/^[^\n]+/) do |m|
          if @block_end && m[0].strip == @block_end
            token Name::Label, m[0]
            @block_end = nil
            goto :root
          else
            token Literal::String::Backtick, m[0]
          end
        end
        rule %r/\n/, Text
      end

      # ─────────── excluded span ───────────
      state :disabled do
        rule(%r/^([^\n]*?)(#{ON_RE}#{BOUND_SRC})([^\n]*)(?=\n|\z)/) do |m|
          token Text, m[1]
          token Keyword::Pseudo, m[2]
          token Text, m[3]
          goto :root
        end
        rule %r/^[ \t]*\n/, Text
        rule %r/[^\n]+/, Comment::Single
        rule %r/\n/, Text
      end

      # ─────────── multi-line meta block (free-form or typed) ───────────
      state :meta_block do
        rule(%r/^[ \t]*#{CM2}[ \t]*(?=\n|\z)/) do |m|
          token Comment::Preproc, m[0]
          goto :root
        end
        rule %r/^[ \t]*\n/, Text
        rule(/^(?=[ \t]*(?:#{DT2}|#{QUAD}))/) { goto :typed_meta_op }
        rule %r/[^\n]+/, Comment::Multiline   # free-form meta text
        rule %r/\n/, Text
      end

      # ─────────── triple line: subject phase ───────────
      state :subject do
        rule %r/[ \t]+/, Text
        rule(/[^\s.,][^\n,]*?(?=[ \t]*(?:#{DT2}|#{QUAD})|[ \t]*#{CM2}|[ \t]*$|\n|\z)/) do |m|
          slot m, Name::Class
          goto :after_subject
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      # ─────────── after subject (or continuation-line entry) ───────────
      state :after_subject do
        rule %r/[ \t]+/, Text
        # QuadDot FIRST: '.. ..' is ONE operator, not two.
        rule(%r/#{QUAD}/) do |m|
          token Operator, m[0]
          goto :object
        end
        rule(%r/#{DT2}/) do |m|
          token Operator, m[0]
          goto :relation
        end
        rule(%r/#{CM2}/) do |m|
          token Comment::Preproc, m[0]
          goto :inline_meta
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      # ─────────── relation phase ───────────
      state :relation do
        rule %r/[ \t]+/, Text
        rule(/[^\s.,][^\n.,]*?(?=[ \t]*#{DT2}|[ \t]*$|\n|\z)/) do |m|
          slot m, Name::Function
          goto :after_relation
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      state :after_relation do
        rule %r/[ \t]+/, Text
        rule(%r/#{DT2}/) do |m|
          token Operator, m[0]
          goto :object
        end
        rule(%r/#{CM2}/) do |m|
          token Comment::Preproc, m[0]
          goto :inline_meta
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      # ─────────── object phase ───────────
      # Object := TextExcept{NL,CM2} — it MAY contain `..` (20-object-dotdot),
      # so it runs to end of line or to a `,,`; it does not stop at a DT2.
      state :object do
        rule %r/[ \t]+/, Text
        rule(%r/#{BLOCK_OPENER}/) { |m| open_block(m) }
        rule(/[^\s,][^\n,]*?(?=[ \t]*#{CM2}|[ \t]*$|\n|\z)/) do |m|
          slot m, Literal::String::Symbol
          goto :after_object
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      state :after_object do
        rule %r/[ \t]+/, Text
        # Trailing `,,` at end-of-line opens a multi-line meta block.
        rule(%r/#{CM2}(?=[ \t]*(?:\n|\z))/) do |m|
          token Comment::Preproc, m[0]
          goto :meta_block_open
        end
        rule(%r/#{CM2}/) do |m|
          token Comment::Preproc, m[0]
          goto :inline_meta
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      state :meta_block_open do
        rule %r/[ \t]+/, Text
        rule(%r/\n/) { |m| token Text, m[0]; goto :meta_block }
      end

      # ─────────── typed meta inside a ,, block ───────────
      state :typed_meta_op do
        rule %r/[ \t]+/, Text
        rule(%r/#{QUAD}/) do |m|          # implicit meta relation
          token Comment::Hashbang, m[0]
          goto :typed_meta_object
        end
        rule(%r/#{DT2}/) do |m|
          token Comment::Hashbang, m[0]
          goto :typed_meta_relation
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :meta_block }
      end

      state :typed_meta_relation do
        rule %r/[ \t]+/, Text
        rule(/[^\s.,][^\n.,]*?(?=[ \t]*#{DT2}|[ \t]*$|\n|\z)/) do |m|
          slot m, Comment::Doc
          goto :typed_meta_after_relation
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :meta_block }
      end

      state :typed_meta_after_relation do
        rule %r/[ \t]+/, Text
        rule(%r/#{DT2}/) do |m|
          token Comment::Hashbang, m[0]
          goto :typed_meta_object
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :meta_block }
      end

      # MetaObjectInBlock := TextExcept{NL} — `;;` is CONTENT here, not a
      # separator (that is the inline form only). See 28-semicolon-in-meta-block.
      state :typed_meta_object do
        rule %r/[ \t]+/, Text
        rule(%r/#{BLOCK_OPENER}/) { |m| open_block(m) }
        rule(/[^\s][^\n]*?(?=[ \t]*$|\n|\z)/) do |m|
          slot m, Comment::Special
          goto :typed_meta_after_object
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :meta_block }
      end

      state :typed_meta_after_object do
        rule %r/[ \t]+/, Text
        rule(%r/\n/) { |m| token Text, m[0]; goto :meta_block }
      end

      # ─────────── inline metadata (after `,,` on a triple line) ───────────
      state :inline_meta do
        # A `..` / `....` right after the `,,` selects the triple form…
        rule(/(?=[ \t]*(?:#{DT2}|#{QUAD}))/) { goto :inline_meta_op }
        # …anything else is free-form meta text, trimmed of surrounding WS.
        rule %r/[ \t]+/, Text
        rule(/[^\s][^\n]*?(?=[ \t]*$|\n|\z)/) { |m| token Comment::Multiline, m[0] }
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      state :inline_meta_op do
        rule %r/[ \t]+/, Text
        rule(%r/#{QUAD}/) do |m|          # implicit meta relation
          token Comment::Hashbang, m[0]
          goto :inline_meta_object
        end
        rule(%r/#{DT2}/) do |m|
          token Comment::Hashbang, m[0]
          goto :inline_meta_relation
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      state :inline_meta_relation do
        rule %r/[ \t]+/, Text
        rule(/[^\s.,][^\n.,]*?(?=[ \t]*#{DT2}|[ \t]*$|\n|\z)/) do |m|
          slot m, Comment::Doc
          goto :inline_meta_after_relation
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      state :inline_meta_after_relation do
        rule %r/[ \t]+/, Text
        rule(%r/#{DT2}/) do |m|
          token Comment::Hashbang, m[0]
          goto :inline_meta_object
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      # MetaObjectInline := TextExcept{NL,SC2} — stops at `;;`.
      state :inline_meta_object do
        rule %r/[ \t]+/, Text
        rule(%r/#{BLOCK_OPENER}/) { |m| open_block(m) }
        rule(/[^\s;][^\n;]*?(?=[ \t]*#{SC2}|[ \t]*$|\n|\z)/) do |m|
          slot m, Comment::Special
          goto :inline_meta_next
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end

      # `;;` divides several (relation, object) pairs about one triple.
      state :inline_meta_next do
        rule %r/[ \t]+/, Text
        rule(%r/#{SC2}/) do |m|
          token Punctuation, m[0]
          goto :inline_meta_op
        end
        rule(%r/\n/) { |m| token Text, m[0]; goto :root }
      end
    end
  end
end
