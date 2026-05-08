// highlight.js language definition for ddot.it (https://ddot.it).
//
// hljs is a regex-mode system. Bygroups (`match: [r1,r2,...] + scope:{}`)
// keys scope by ARRAY POSITION, not capture group. We can't map "command
// vs name" via overlapping alternation in one rule, so we split each line
// shape with a command-subject vs name-subject variant. Per the corpus,
// commands only appear as triple subjects (or standalone off/on markers),
// so we only need that one axis of variants — kept tractable.
//
// Token mapping: hljs scopes equal canonical names directly.

export default function ddotHighlightJs(/* hljs */) {
  // ── Regex building blocks ───────────────────────────────────────
  const CMD       = /(?:ddot\.it(?:\/[\w.\-]+)?|!![\w.\-]*)/;
  const NAME_SUBJ = /[^\s.,][^\n,]*?/;
  const NAME_REL  = /[^\s.,][^\n.,]*?/;
  const NAME_OBJ  = /[^\s,][^\n,]*?/;
  const OP_TYPED   = /\.{2}/;
  const OP_UNTYPED = /\.{4}|\.{2}[ \t]+\.{2}/;

  // Ws helpers (whitespace positions get no scope so they're "skipped").
  const LEAD = /^[ \t]*/;
  const WS   = /[ \t]*/;
  const TAIL = /[ \t]*$/;

  // ── Per-line rule constructors ──────────────────────────────────

  // Typed triple plain: SUBJ .. REL .. OBJ
  const TYPED_TRIPLE_PLAIN = (subjectPattern, subjectScope) => ({
    match: [LEAD, subjectPattern, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: { 2: subjectScope, 4: 'operator', 6: 'relation', 8: 'operator', 10: 'object' },
  });

  // Typed triple + inline meta: SUBJ .. REL .. OBJ ,, .. REL .. OBJ
  const TYPED_TRIPLE_INLINE_META = (subjectPattern, subjectScope) => ({
    match: [LEAD, subjectPattern, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, WS, /,,/, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: {
      2: subjectScope, 4: 'operator', 6: 'relation', 8: 'operator', 10: 'object',
      12: 'meta-delim', 14: 'meta-operator', 16: 'meta-relation', 18: 'meta-operator', 20: 'meta-object',
    },
  });

  // Untyped triple plain: SUBJ (....|.. ..) OBJ
  const UNTYPED_TRIPLE_PLAIN = (subjectPattern, subjectScope) => ({
    match: [LEAD, subjectPattern, WS, OP_UNTYPED, WS, NAME_OBJ, TAIL],
    scope: { 2: subjectScope, 4: 'operator', 6: 'object' },
  });

  // Untyped triple + inline meta
  const UNTYPED_TRIPLE_INLINE_META = (subjectPattern, subjectScope) => ({
    match: [LEAD, subjectPattern, WS, OP_UNTYPED, WS, NAME_OBJ, WS, /,,/, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: {
      2: subjectScope, 4: 'operator', 6: 'object',
      8: 'meta-delim', 10: 'meta-operator', 12: 'meta-relation', 14: 'meta-operator', 16: 'meta-object',
    },
  });

  // Typed continuation plain: .. REL .. OBJ
  const TYPED_CONT_PLAIN = {
    match: [LEAD, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: { 2: 'operator', 4: 'relation', 6: 'operator', 8: 'object' },
  };
  // Typed continuation + inline meta
  const TYPED_CONT_INLINE_META = {
    match: [LEAD, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, WS, /,,/, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: {
      2: 'operator', 4: 'relation', 6: 'operator', 8: 'object',
      10: 'meta-delim', 12: 'meta-operator', 14: 'meta-relation', 16: 'meta-operator', 18: 'meta-object',
    },
  };
  // Untyped continuation plain: (....|.. ..) OBJ
  const UNTYPED_CONT_PLAIN = {
    match: [LEAD, OP_UNTYPED, WS, NAME_OBJ, TAIL],
    scope: { 2: 'operator', 4: 'object' },
  };
  // Untyped continuation + inline meta
  const UNTYPED_CONT_INLINE_META = {
    match: [LEAD, OP_UNTYPED, WS, NAME_OBJ, WS, /,,/, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: {
      2: 'operator', 4: 'object',
      6: 'meta-delim', 8: 'meta-operator', 10: 'meta-relation', 12: 'meta-operator', 14: 'meta-object',
    },
  };

  // Inside typed_meta_block: each line is `..rel.. obj`.
  const TYPED_META_CONTINUATION = {
    match: [LEAD, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, TAIL],
    scope: { 2: 'meta-operator', 4: 'meta-relation', 6: 'meta-operator', 8: 'meta-object' },
  };

  // ── Block-meta-open variants (begin/end modes) ──────────────────

  // Helper to build a block-meta-open mode whose `begin` is a complete
  // line ending in `,,` and whose `end` is a standalone `,,`.
  const blockMetaOpen = (beginPatterns, beginScope) => ({
    begin: beginPatterns,
    beginScope,
    end: [LEAD, /,,/, TAIL],
    endScope: { 2: 'meta-delim' },
    contains: [TYPED_META_CONTINUATION],
  });

  const TYPED_TRIPLE_BLOCK_META = (subjectPattern, subjectScope) =>
    blockMetaOpen(
      [LEAD, subjectPattern, WS, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, WS, /,,/, TAIL],
      { 2: subjectScope, 4: 'operator', 6: 'relation', 8: 'operator', 10: 'object', 12: 'meta-delim' },
    );
  const UNTYPED_TRIPLE_BLOCK_META = (subjectPattern, subjectScope) =>
    blockMetaOpen(
      [LEAD, subjectPattern, WS, OP_UNTYPED, WS, NAME_OBJ, WS, /,,/, TAIL],
      { 2: subjectScope, 4: 'operator', 6: 'object', 8: 'meta-delim' },
    );
  const TYPED_CONT_BLOCK_META = blockMetaOpen(
    [LEAD, OP_TYPED, WS, NAME_REL, WS, OP_TYPED, WS, NAME_OBJ, WS, /,,/, TAIL],
    { 2: 'operator', 4: 'relation', 6: 'operator', 8: 'object', 10: 'meta-delim' },
  );
  const UNTYPED_CONT_BLOCK_META = blockMetaOpen(
    [LEAD, OP_UNTYPED, WS, NAME_OBJ, WS, /,,/, TAIL],
    { 2: 'operator', 4: 'object', 6: 'meta-delim' },
  );

  // Free-form `,,` block.
  const META_TEXT_BLOCK = {
    begin: [LEAD, /,,/, TAIL],
    beginScope: { 2: 'meta-delim' },
    end: [LEAD, /,,/, TAIL],
    endScope: { 2: 'meta-delim' },
    contains: [
      { match: /^[ \t]*[^\s,][^\n]*?[ \t]*$/m, scope: 'meta-text' },
    ],
  };

  // Off / on disabled span. Inner content matcher must NOT match on-marker
  // lines, otherwise it consumes them before END fires.
  const DISABLED = {
    begin: [LEAD, /(?:ddot\.it\/off|!!off)/, TAIL],
    beginScope: { 2: 'command' },
    end: [LEAD, /(?:ddot\.it\/on|!!on)/, TAIL],
    endScope: { 2: 'command' },
    contains: [
      { match: /^(?![ \t]*(?:ddot\.it\/on|!!on)[ \t]*$)[^\n]+$/m, scope: 'disabled' },
    ],
  };

  return {
    name: 'ddot.it',
    aliases: ['ddot', 'ddotit'],
    contains: [
      // Block modes first.
      DISABLED,
      META_TEXT_BLOCK,
      // Block-meta-open variants — must come before plain because they
      // include the trailing `,,` in the match.
      TYPED_CONT_BLOCK_META,
      UNTYPED_CONT_BLOCK_META,
      TYPED_TRIPLE_BLOCK_META(CMD, 'command'),
      TYPED_TRIPLE_BLOCK_META(NAME_SUBJ, 'subject'),
      UNTYPED_TRIPLE_BLOCK_META(CMD, 'command'),
      UNTYPED_TRIPLE_BLOCK_META(NAME_SUBJ, 'subject'),
      // Inline-meta variants.
      TYPED_CONT_INLINE_META,
      UNTYPED_CONT_INLINE_META,
      TYPED_TRIPLE_INLINE_META(CMD, 'command'),
      TYPED_TRIPLE_INLINE_META(NAME_SUBJ, 'subject'),
      UNTYPED_TRIPLE_INLINE_META(CMD, 'command'),
      UNTYPED_TRIPLE_INLINE_META(NAME_SUBJ, 'subject'),
      // Plain.
      TYPED_CONT_PLAIN,
      UNTYPED_CONT_PLAIN,
      TYPED_TRIPLE_PLAIN(CMD, 'command'),
      TYPED_TRIPLE_PLAIN(NAME_SUBJ, 'subject'),
      UNTYPED_TRIPLE_PLAIN(CMD, 'command'),
      UNTYPED_TRIPLE_PLAIN(NAME_SUBJ, 'subject'),
    ],
  };
}
