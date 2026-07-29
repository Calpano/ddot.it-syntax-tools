// highlight.js language definition for ddot.it (https://ddot.it).
//
// hljs is a regex-mode system. Bygroups (`match: [r1,r2,...] + scope:{}`) keys
// scope by ARRAY POSITION, not capture group, and a match array has a FIXED
// length. Two consequences shape this file:
//
//   * "command vs name" in a slot cannot be expressed by alternation inside one
//     group, so each line shape is emitted twice — once per subject kind, and
//     once per relation kind where a command can appear there (15-label).
//   * The inline meta part carries an UNBOUNDED number of `;;`-separated pairs
//     (22-inline-meta-separator), which no fixed array can describe. It is
//     therefore a begin/end MODE whose `contains` matches one pair at a time.
//     The same applies to `!!block` bodies and `,,` blocks.
//
// A triple-head rule therefore stops at `,,` (via lookahead) instead of running
// to end of line, so the meta mode can take over.
//
// Token mapping: hljs scopes equal canonical names directly.

export default function ddotHighlightJs(/* hljs */) {
  // ── Lexical building blocks ─────────────────────────────────────
  // Runs of EXACTLY n, neither preceded nor followed by the same character.
  // `\.{2}` alone would match the first two dots of `...`.
  const DT2 = /(?<!\.)\.{2}(?!\.)/;
  const QUAD = /(?<!\.)(?:\.{4}|\.{2}[ \t]+\.{2})(?!\.)/;
  const CM2 = /(?<!,),,(?!,)/;
  const SC2 = /(?<!;);;(?!;)/;

  // A command needs the slash and a non-empty name; bare `ddot.it` is not one.
  const CMD = /(?:(?:https?:\/\/)?ddot\.it\/|!!)[^\s?#]+(?:\?[^\s#]*)?(?:#\S*)?/;
  const BLOCK = /(?:(?:https?:\/\/)?ddot\.it\/|!!)block/;

  const NAME_SUBJ = /[^\s.,][^\n,]*?/;
  const NAME_REL = /[^\s.,][^\n.,]*?/;
  const NAME_OBJ = /[^\s,][^\n,]*?/;

  const LEAD = /^[ \t]*/;
  const WS = /[ \t]*/;
  // A triple head ends at `,,` or end of line — NOT consuming either, so the
  // meta mode can start.
  const HEAD_END = /(?=[ \t]*(?:(?<!,),,(?!,)|$))/;

  // ── Meta: one `..rel.. obj` pair, or the untyped `.... obj` form ──
  const META_PAIR = {
    match: [WS, DT2, WS, NAME_REL, WS, DT2, WS, /[^\s;][^\n;]*?/, /(?=[ \t]*(?:(?<!;);;(?!;)|$))/],
    scope: { 2: 'meta-doubledot', 4: 'meta-relation', 6: 'meta-doubledot', 8: 'meta-object' },
  };
  const META_PAIR_UNTYPED = {
    match: [WS, QUAD, WS, /[^\s;][^\n;]*?/, /(?=[ \t]*(?:(?<!;);;(?!;)|$))/],
    scope: { 2: 'meta-doubledot', 4: 'meta-object' },
  };
  const META_SEPARATOR = { match: SC2, scope: 'meta-separator' };
  // Fallback: free-form inline meta text, trimmed of surrounding whitespace.
  const META_TEXT = { match: /[^\s][^\n]*?(?=[ \t]*$)/, scope: 'meta-text' };

  // The inline meta part: `,,` then any number of pairs, or free text.
  const INLINE_META = {
    begin: CM2,
    beginScope: 'meta-delim',
    end: /$/,
    contains: [META_PAIR, META_PAIR_UNTYPED, META_SEPARATOR, META_TEXT],
  };

  // Parse Spec "block-continuation": after a block META OBJECT the logical line
  // resumes on a line whose first token is SC2 (`;; ..until.. 2020`). Same body
  // as INLINE_META, but opened by the separator rather than by `,,`. Without it
  // the line reads as a fresh triple whose subject is `;;`.
  const META_CONTINUATION = {
    begin: [/^[ \t]*/, SC2, /(?=[ \t]+)/],
    beginScope: { 2: 'meta-separator' },
    end: /$/,
    contains: [META_PAIR, META_PAIR_UNTYPED, META_SEPARATOR, META_TEXT],
  };

  // ── !!block: a verbatim region terminated by a blank line ────────
  // The `?end=MARKER` form needs the terminator to equal text captured
  // earlier, which hljs cannot express; see the waiver in the conformance
  // harness. Only the blank-line form is implemented.
  const VERBATIM_BODY = { match: /^[ \t]*\S[^\n]*$/m, scope: 'verbatim' };

  // The `?end=MARKER` form: the terminator is a line equal to text captured in
  // `begin`, which no static `end` regex can express. hljs can do it with
  // callbacks: `on:begin` stashes the marker in `resp.data`, and `on:end`
  // rejects any candidate terminator that does not equal it via ignoreMatch().
  // `?end=MARKER` — NOT fully supported; see the waiver in
  // tools/conformance-highlightjs.mjs.
  //
  // The terminator is a line equal to text captured in `begin`. hljs has
  // `on:begin`/`on:end` callbacks and `ignoreMatch()`, which looks like enough,
  // but is not: when a `contains` rule and `end` match at the SAME offset hljs
  // prefers `contains`, and calling ignoreMatch() there makes it re-scan from
  // offset+1 rather than giving `end` a turn at the same position. So the body
  // rule cannot hand the marker line over to `end`.
  //
  // The opener is still scoped correctly (command / command-param / block-end),
  // and the region is terminated by a BLANK line as in the unmarked form. That
  // is wrong for input where the marker arrives before any blank line, but the
  // error stays local instead of turning the rest of the document verbatim.
  const markedBlockFrom = (beginPatterns, beginScope) => ({
    begin: beginPatterns,
    beginScope,
    end: /^[ \t]*$/m,
    contains: [VERBATIM_BODY],
  });
  const blockFrom = (beginPatterns, beginScope) => ({
    begin: beginPatterns,
    beginScope,
    end: /^[ \t]*$/m,
    contains: [VERBATIM_BODY],
  });

  // ── Line shapes ─────────────────────────────────────────────────
  // Typed triple head: SUBJ .. REL .. OBJ   (relation may itself be a command)
  const typedHead = (subjPat, subjScope, relPat, relScope) => ({
    match: [LEAD, subjPat, WS, DT2, WS, relPat, WS, DT2, WS, NAME_OBJ, HEAD_END],
    scope: { 2: subjScope, 4: 'doubledot', 6: relScope, 8: 'doubledot', 10: 'object' },
  });
  // Untyped triple head: SUBJ (....|.. ..) OBJ
  const untypedHead = (subjPat, subjScope) => ({
    match: [LEAD, subjPat, WS, QUAD, WS, NAME_OBJ, HEAD_END],
    scope: { 2: subjScope, 4: 'doubledot', 6: 'object' },
  });
  // Continuation lines (subject omitted).
  const typedCont = (relPat, relScope) => ({
    match: [LEAD, DT2, WS, relPat, WS, DT2, WS, NAME_OBJ, HEAD_END],
    scope: { 2: 'doubledot', 4: relScope, 6: 'doubledot', 8: 'object' },
  });
  const UNTYPED_CONT = {
    match: [LEAD, QUAD, WS, NAME_OBJ, HEAD_END],
    scope: { 2: 'doubledot', 4: 'object' },
  };

  // Block openers, per field position (block-as-field: Subject, Object,
  // MetaObject). The opener must END its physical line.
  const BLOCK_SUBJECT = blockFrom([LEAD, BLOCK, /[ \t]*$/], { 2: 'command' });
  const BLOCK_SUBJECT_MARKED = markedBlockFrom(
    [LEAD, BLOCK, /\?end=/, /\S+/, /[ \t]*$/],
    { 2: 'command', 3: 'command-param', 4: 'block-end' },
  );
  const blockObjectMarked = (subjPat, subjScope, relPat, relScope) =>
    markedBlockFrom(
      [LEAD, subjPat, WS, DT2, WS, relPat, WS, DT2, WS, BLOCK, /\?end=/, /\S+/, /[ \t]*$/],
      { 2: subjScope, 4: 'doubledot', 6: relScope, 8: 'doubledot',
        10: 'command', 11: 'command-param', 12: 'block-end' },
    );
  const blockObject = (subjPat, subjScope, relPat, relScope) =>
    blockFrom(
      [LEAD, subjPat, WS, DT2, WS, relPat, WS, DT2, WS, BLOCK, /[ \t]*$/],
      { 2: subjScope, 4: 'doubledot', 6: relScope, 8: 'doubledot', 10: 'command' },
    );
  // A CONTINUATION line may itself end in a block opener (`..knows.. !!block`),
  // so one logical line can carry a block subject AND a block object — corpus
  // case 32-chained-blocks. Same shape as blockObject with the subject omitted.
  const BLOCK_OBJECT_CONT = blockFrom(
    [LEAD, DT2, WS, NAME_REL, WS, DT2, WS, BLOCK, /[ \t]*$/],
    { 2: 'doubledot', 4: 'relation', 6: 'doubledot', 8: 'command' },
  );
  const BLOCK_OBJECT_CONT_MARKED = markedBlockFrom(
    [LEAD, DT2, WS, NAME_REL, WS, DT2, WS, BLOCK, /\?end=/, /\S+/, /[ \t]*$/],
    { 2: 'doubledot', 4: 'relation', 6: 'doubledot',
      8: 'command', 9: 'command-param', 10: 'block-end' },
  );
  const blockMetaObject = (subjPat, subjScope) =>
    blockFrom(
      [LEAD, subjPat, WS, DT2, WS, NAME_REL, WS, DT2, WS, NAME_OBJ, WS, CM2, WS, DT2, WS, NAME_REL, WS, DT2, WS, BLOCK, /[ \t]*$/],
      {
        2: subjScope, 4: 'doubledot', 6: 'relation', 8: 'doubledot', 10: 'object',
        12: 'meta-delim', 14: 'meta-doubledot', 16: 'meta-relation', 18: 'meta-doubledot', 20: 'command',
      },
    );

  // ── `,,` block (meta on its own lines) ──────────────────────────
  const META_BLOCK_PAIR = {
    match: [LEAD, DT2, WS, NAME_REL, WS, DT2, WS, /[^\s][^\n]*?/, /[ \t]*$/],
    scope: { 2: 'meta-doubledot', 4: 'meta-relation', 6: 'meta-doubledot', 8: 'meta-object' },
  };
  const META_BLOCK_PAIR_UNTYPED = {
    match: [LEAD, QUAD, WS, /[^\s][^\n]*?/, /[ \t]*$/],
    scope: { 2: 'meta-doubledot', 4: 'meta-object' },
  };
  // A block line that is not a pair is free-form meta text.
  const META_BLOCK_TEXT = {
    match: /^[ \t]*[^\s,][^\n]*?[ \t]*$/m,
    scope: 'meta-text',
  };
  const metaBlockFrom = (beginPatterns, beginScope) => ({
    begin: beginPatterns,
    beginScope,
    end: [LEAD, CM2, /[ \t]*$/],
    endScope: { 2: 'meta-delim' },
    contains: [META_BLOCK_PAIR, META_BLOCK_PAIR_UNTYPED, META_BLOCK_TEXT],
  });

  const typedBlockMeta = (subjPat, subjScope) =>
    metaBlockFrom(
      [LEAD, subjPat, WS, DT2, WS, NAME_REL, WS, DT2, WS, NAME_OBJ, WS, CM2, /[ \t]*$/],
      { 2: subjScope, 4: 'doubledot', 6: 'relation', 8: 'doubledot', 10: 'object', 12: 'meta-delim' },
    );
  const untypedBlockMeta = (subjPat, subjScope) =>
    metaBlockFrom(
      [LEAD, subjPat, WS, QUAD, WS, NAME_OBJ, WS, CM2, /[ \t]*$/],
      { 2: subjScope, 4: 'doubledot', 6: 'object', 8: 'meta-delim' },
    );
  const TYPED_CONT_BLOCK_META = metaBlockFrom(
    [LEAD, DT2, WS, NAME_REL, WS, DT2, WS, NAME_OBJ, WS, CM2, /[ \t]*$/],
    { 2: 'doubledot', 4: 'relation', 6: 'doubledot', 8: 'object', 10: 'meta-delim' },
  );
  // Standalone `,,` — opens a block after an already-complete triple line.
  const STANDALONE_BLOCK_META = metaBlockFrom([LEAD, CM2, /[ \t]*$/], { 2: 'meta-delim' });

  // ── off / on excluded span ──────────────────────────────────────
  // The inner matcher must NOT match on-marker lines, or it consumes them
  // before `end` fires.
  const DISABLED = {
    begin: [/^[^\n]*?/, /(?:ddot\.it\/off|!!off)(?![^\s?#])/, /[^\n]*$/],
    beginScope: { 2: 'command' },
    end: [/^[^\n]*?/, /(?:ddot\.it\/on|!!on)(?![^\s?#])/, /[^\n]*$/],
    endScope: { 2: 'command' },
    contains: [
      { match: /^(?![^\n]*(?:ddot\.it\/on|!!on)(?![^\s?#]))[^\n]+$/m, scope: 'excluded' },
    ],
  };

  return {
    name: 'ddot.it',
    aliases: ['ddot', 'ddotit'],
    contains: [
      // Multi-line modes first — they include their own opening line.
      DISABLED,
      BLOCK_SUBJECT_MARKED,
      BLOCK_SUBJECT,
      BLOCK_OBJECT_CONT_MARKED,
      BLOCK_OBJECT_CONT,
      blockObjectMarked(CMD, 'command', CMD, 'command'),
      blockObjectMarked(CMD, 'command', NAME_REL, 'relation'),
      blockObjectMarked(NAME_SUBJ, 'subject', CMD, 'command'),
      blockObjectMarked(NAME_SUBJ, 'subject', NAME_REL, 'relation'),
      blockMetaObject(CMD, 'command'),
      blockMetaObject(NAME_SUBJ, 'subject'),
      blockObject(CMD, 'command', CMD, 'command'),
      blockObject(CMD, 'command', NAME_REL, 'relation'),
      blockObject(NAME_SUBJ, 'subject', CMD, 'command'),
      blockObject(NAME_SUBJ, 'subject', NAME_REL, 'relation'),
      META_CONTINUATION,
      STANDALONE_BLOCK_META,
      TYPED_CONT_BLOCK_META,
      typedBlockMeta(CMD, 'command'),
      typedBlockMeta(NAME_SUBJ, 'subject'),
      untypedBlockMeta(CMD, 'command'),
      untypedBlockMeta(NAME_SUBJ, 'subject'),
      // Single-line heads. INLINE_META picks up any `,,` they leave behind.
      typedCont(CMD, 'command'),
      typedCont(NAME_REL, 'relation'),
      UNTYPED_CONT,
      typedHead(CMD, 'command', CMD, 'command'),
      typedHead(CMD, 'command', NAME_REL, 'relation'),
      typedHead(NAME_SUBJ, 'subject', CMD, 'command'),
      typedHead(NAME_SUBJ, 'subject', NAME_REL, 'relation'),
      untypedHead(CMD, 'command'),
      untypedHead(NAME_SUBJ, 'subject'),
      INLINE_META,
    ],
  };
}
