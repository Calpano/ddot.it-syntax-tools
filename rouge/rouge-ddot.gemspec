# frozen_string_literal: true

Gem::Specification.new do |s|
  s.name        = 'rouge-ddot'
  s.version     = '0.1.0'
  s.summary     = 'Rouge lexer for ddot.it'
  s.description = 'Syntax highlighter for the ddot.it knowledge graph notation. ' \
                  'Plugs into Rouge so any tool that uses Rouge for source ' \
                  'highlighting (Asciidoctor, Jekyll, GitLab, …) can colourise ' \
                  '[source,ddot] blocks against the canonical token vocabulary.'
  s.authors     = ['Calpano']
  s.email       = ['hello@calpano.com']
  s.homepage    = 'https://ddot.it'
  s.license     = 'MIT'

  s.required_ruby_version = '>= 2.7'
  s.add_runtime_dependency 'rouge', '>= 3.30'

  s.files = Dir[
    'lib/**/*.rb',
    'README.md',
    'rouge-ddot.gemspec'
  ]
  s.require_paths = ['lib']

  s.metadata = {
    'source_code_uri' => 'https://github.com/calpano/ddot.it-syntax-tools',
    'bug_tracker_uri' => 'https://github.com/calpano/ddot.it-syntax-tools/issues'
  }
end
