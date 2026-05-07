#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Rouge conformance: tokenize each ../ddot.it/test-data/cases/*/input.ddot
# with the Rouge lexer in `../rouge/lib/rouge/lexers/ddot.rb` and assert byte
# equality of the canonical-mapped token stream against
# `expected.tokens.json`.
#
#   ruby tools/conformance-rouge.rb
#   npm run conformance:rouge          # npm-wrapped form
#   npm run conformance                # both rouge + textmate
#
# Reports per-case pass/fail. Exits non-zero if any case diverges.

require 'json'
require 'pathname'

here     = Pathname.new(__dir__).realpath
repo     = here.parent
cases    = (repo / '..' / 'ddot.it' / 'test-data' / 'cases').realpath
lexer_rb = (repo / 'rouge' / 'lib' / 'rouge' / 'lexers' / 'ddot.rb').realpath

require 'rouge'
require lexer_rb.to_s

# Rouge token class → canonical token name in tokens.md.
ROUGE_TO_CANONICAL = {
  'Name.Class'              => 'subject',
  'Name.Function'           => 'relation',
  'Literal.String.Symbol'   => 'object',
  'Operator'                => 'operator',
  'Keyword.Pseudo'          => 'command',
  'Comment.Preproc'         => 'meta-delim',
  'Comment.Hashbang'        => 'meta-operator',
  'Comment.Doc'             => 'meta-relation',
  'Comment.Special'         => 'meta-object',
  'Comment.Multiline'       => 'meta-text',
  'Comment.Single'          => 'disabled'
}.freeze

# Tokenize and produce flat [{line,start,end,token,text}] entries, dropping
# whitespace-only chunks the way the TextMate harness does.
def tokenize_canonical(input, lexer)
  out = []
  line = 0
  col  = 0
  lexer.lex(input).each do |tok, val|
    val.split(/(\n)/).each do |chunk|
      if chunk == "\n"
        line += 1
        col = 0
        next
      end
      next if chunk.empty?
      qualified = tok.qualname  # e.g. "Name.Class"
      canonical = ROUGE_TO_CANONICAL[qualified]
      if canonical
        out << {
          'line'  => line,
          'start' => col,
          'end'   => col + chunk.length,
          'token' => canonical,
          'text'  => chunk
        }
      end
      col += chunk.length
    end
  end
  out
end

def diff(actual, expected)
  lines = []
  n = [actual.size, expected.size].max
  (0...n).each do |i|
    a = actual[i]
    e = expected[i]
    if a == e
      next
    end
    lines << "  ##{i}"
    lines << "    expected: #{e ? e.to_json : '(none)'}"
    lines << "    actual:   #{a ? a.to_json : '(none)'}"
    break if lines.size > 30
  end
  lines
end

lexer = Rouge::Lexers::Ddot.new
failures = []
case_dirs = cases.children.select(&:directory?).sort
case_dirs.each do |dir|
  name = dir.basename.to_s
  input = dir / 'input.ddot'
  expected_path = dir / 'expected.tokens.json'
  unless input.file? && expected_path.file?
    puts "skip  #{name}"
    next
  end
  expected = JSON.parse(expected_path.read)
  actual = tokenize_canonical(input.read, lexer)
  if actual == expected
    puts "ok    #{name}"
  else
    failures << name
    puts "FAIL  #{name}"
    puts diff(actual, expected).join("\n")
  end
end

if failures.empty?
  puts "\nall #{case_dirs.size} cases pass"
  exit 0
else
  warn "\n#{failures.size}/#{case_dirs.size} cases diverge: #{failures.join(', ')}"
  exit 1
end
