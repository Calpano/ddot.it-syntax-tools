# rouge-ddot

[Rouge](https://github.com/rouge-ruby/rouge) lexer for the ddot.it knowledge
graph notation (https://ddot.it).

## Usage

```ruby
require 'rouge'
require 'rouge/lexers/ddot'

Rouge::Lexers::Ddot.new.lex("Project Eagle ..started in.. 2024") do |tok, val|
  puts [tok.qualname, val].inspect
end
```

In Asciidoctor with `:source-highlighter: rouge` set, `[source,ddot]` blocks
are dispatched here automatically — no extra wiring per document.

## Token mapping

The lexer emits standard Rouge tokens; they map to the canonical ddot.it
token vocabulary in [`../../ddot.it/test-data/tokens.md`](../../ddot.it/test-data/tokens.md):

| Rouge                       | Canonical       |
|-----------------------------|-----------------|
| `Name::Class`               | `subject`       |
| `Name::Function`            | `relation`      |
| `Literal::String::Symbol`   | `object`        |
| `Operator`                  | `operator`      |
| `Keyword::Pseudo`           | `command`       |
| `Comment::Preproc`          | `meta-delim`    |
| `Comment::Hashbang`         | `meta-operator` |
| `Comment::Doc`              | `meta-relation` |
| `Comment::Special`          | `meta-object`   |
| `Comment::Multiline`        | `meta-text`     |
| `Comment::Single`           | `disabled`      |

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
│   └── rouge/
│       └── lexers/
│           └── ddot.rb          # the lexer
├── README.md
└── rouge-ddot.gemspec
```

## License

MIT.
