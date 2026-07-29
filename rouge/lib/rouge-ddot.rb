# Entry point for `require 'rouge-ddot'` — the path Bundler takes when the gem
# is listed in a Jekyll `:jekyll_plugins` group, or under any other
# `Bundler.require`, which requires a gem by its *name*.
#
# Rouge does not auto-discover third-party lexers: a lexer is registered only
# when its file is loaded. Up to 0.1.2 the gem shipped `lib/rouge/lexers/ddot.rb`
# alone, so `require 'rouge-ddot'` raised LoadError and every host had to know
# the internal path and write `require 'rouge/lexers/ddot'` into a plugin file
# of its own. This file makes the conventional require work.
#
# `require_relative` rather than `require` so loading does not depend on this
# gem's lib directory being on `$LOAD_PATH`. The lexer requires 'rouge' itself.
require_relative 'rouge/lexers/ddot'
