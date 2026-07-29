# rouge-ddot

[Rouge](https://github.com/rouge-ruby/rouge) lexer for the ddot.it knowledge
graph notation (https://ddot.it).

## Usage

```ruby
require 'rouge-ddot'

Rouge::Lexers::Ddot.new.lex("Project Eagle ..started in.. 2024") do |tok, val|
  puts [tok.qualname, val].inspect
end
```

Rouge does not auto-discover third-party lexers, so the gem has to be required
before a `ddot.it` block can be highlighted. Requiring it by name is enough
(since 0.1.3); `require 'rouge/lexers/ddot'` also works.

In **Jekyll**, put it in the `:jekyll_plugins` group and Bundler requires it at
startup — no `_plugins/` file needed:

```ruby
# Gemfile
group :jekyll_plugins do
  gem 'rouge-ddot', '~> 0.1.3'
end
```

In Asciidoctor with `:source-highlighter: rouge` set, `[source,ddot]` blocks
are dispatched here automatically — no extra wiring per document. The lexer
registers under the tag `ddot`, with the aliases `ddotit` and `ddot.it`.

## Token mapping

The lexer emits standard Rouge tokens; they map to the canonical ddot.it
token vocabulary in [`../../ddot.it/test-data/tokens.md`](../../ddot.it/test-data/tokens.md):

| Rouge                       | Canonical        |
|-----------------------------|------------------|
| `Name::Class`               | `subject`        |
| `Name::Function`            | `relation`       |
| `Literal::String::Symbol`   | `object`         |
| `Operator`                  | `doubledot`      |
| `Keyword::Pseudo`           | `command`        |
| `Name::Attribute`           | `command-param`  |
| `Name::Label`               | `block-end`      |
| `Comment::Preproc`          | `meta-delim`     |
| `Punctuation`               | `meta-separator` |
| `Comment::Hashbang`         | `meta-doubledot` |
| `Comment::Doc`              | `meta-relation`  |
| `Comment::Special`          | `meta-object`    |
| `Comment::Multiline`        | `meta-text`      |
| `Comment::Single`           | `excluded`       |
| `Literal::String::Backtick` | `verbatim`       |

## Conformance

The lexer is asserted byte-equal to the corpus at
[`../../ddot.it/test-data/cases/*/expected.tokens.json`](../../ddot.it/test-data/cases/)
(after the mapping above). To run:

```sh
# from the ddot.it-syntax-tools/ root
ruby tools/conformance-rouge.rb       # exits non-zero on any case diverging
npm run conformance:rouge             # npm-wrapped form
```

The same corpus also feeds `npm run conformance:textmate`. Any change to the
canonical vocabulary or adding a case must keep both implementations in
lockstep.

## Layout

```
rouge/
├── lib/
│   ├── rouge-ddot.rb            # entry point: require 'rouge-ddot'
│   └── rouge/
│       └── lexers/
│           └── ddot.rb          # the lexer
├── CHANGELOG.md
├── README.md
└── rouge-ddot.gemspec
```

## License

MIT.
