// Prism.js language definition for ddot.it (https://ddot.it).
//
// Prism applies patterns in priority order, splitting the remaining
// un-tokenized text as it goes. Everything here is therefore organised as
// WHOLE-LINE (or whole-region) patterns with their own `inside` grammars,
// rather than as free-floating slot patterns:
//
//   * It gives us the line-shape GATE. A slot pattern matching anywhere would
//     light up a lone `..` in prose; a line pattern can require the full
//     operator skeleton (two DT2, or one DT4/'.. ..') in a lookahead before
//     anything inside it is scoped. That is what keeps 23-not-a-triple plain.
//   * `inside` grammars cannot reach across already-tokenized chunks, so the
//     meta part and block bodies each need their own region anyway.
//
// Within a line's `inside`, order still matters: slots are anchored by
// lookbehind/lookahead against the `..` markers, and `operator` runs LAST so
// those markers are still present in the text while the slots look at them.
// Prism's `lookbehind: true` means group 1 is matched but stripped from the
// token and left in place for later patterns.
//
// KNOWN LIMITATION — `!!block?end=MARKER` (case 21) is not supported: its
// terminator is a line equal to text captured earlier, and Prism patterns are
// static regexes with no callbacks or state. The blank-line form works.
//
// Token mapping: Prism token names equal canonical names directly.

import Prism from 'prismjs';

// WS := TAB + every Unicode space separator (category Zs) — Parse Spec
// "what counts as WS". NBSP (U+00A0) & co. are visually identical to a
// space, so they must not end up inside a slot value. Written as explicit
// escapes rather than \p{Zs} so no /u flag is required.
const WS = '\\t\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u202F\\u205F\\u3000';
// …plus what JS \s also covers, for negated classes.
const WSX = WS + '\\r\\n\\f\\v';

// ── Lexical building blocks ───────────────────────────────────────
// Runs of EXACTLY n, neither preceded nor followed by the same character.
const DT2 = '(?<!\\.)\\.{2}(?!\\.)';
const DT4 = '(?<!\\.)\\.{4}(?!\\.)';
const QUAD = `(?<!\\.)(?:\\.{4}|\\.{2}[${WS}]+\\.{2})(?!\\.)`;
const CM2 = '(?<!,),,(?!,)';
const SC2 = '(?<!;);;(?!;)';

// A command needs the slash and a non-empty name; bare `ddot.it` is not one.
const CMD = `(?:(?:https?://)?ddot\\.it/|!!)[^${WSX}?#]+(?:\\?[^${WSX}#]*)?(?:#[^${WSX}]*)?`;
const BLOCK = '(?:(?:https?://)?ddot\\.it/|!!)block';

// Tempered tokens: Subject and Relation are TextExcept{...,DT2,DT4}, so every
// character is guarded against starting a `..`. Without this a lazy match runs
// past the first marker to the second ("a ..knows" as the subject of
// `a ..knows.. b`).
const NAME_SUBJ = `(?:(?!${DT2})[^${WSX},])(?:(?:(?!${DT2})[^\\n,])*(?:(?!${DT2})[^${WSX},]))?`;
const NAME_REL = `(?:(?!${DT2})[^${WSX},])(?:(?:(?!${DT2})[^\\n,])*(?:(?!${DT2})[^${WSX},]))?`;
const NAME_OBJ = `(?:[^${WSX},][^\\n,]*?[^${WSX},]|[^${WSX},])`;
// A run of characters, none of which starts a `..`.
const NO_DT2 = `(?:(?!${DT2})[^\\n])*`;
const NAME_MOBJ = `(?:[^${WSX};][^\\n;]*?[^${WSX};]|[^${WSX};])`;

// The gate: a line is ddot.it only with a full operator skeleton.
const GATE = `(?=[^\\n]*(?:${DT4}|${DT2}[^\\n]*${DT2}))`;

// ── Inline meta (after `,,` on a triple line) ─────────────────────
const inlineMetaInside = {
  'meta-delim': new RegExp(`^${CM2}`),
  'meta-separator': new RegExp(SC2),
  'meta-relation': {
    pattern: new RegExp(`(${DT2}[${WS}]*)(${NAME_REL})(?=[${WS}]*${DT2})`),
    lookbehind: true,
  },
  'meta-object': {
    pattern: new RegExp(`(${QUAD}[${WS}]+|${DT2}[${WS}]+)(${NAME_MOBJ})(?=[${WS}]*(?:${SC2}|$))`, 'm'),
    lookbehind: true,
    inside: { 'command': new RegExp(`^${CMD}$`) },
  },
  'meta-doubledot': new RegExp(`${QUAD}|${DT2}`),
  // Free-form meta text: whatever is left after a `,,` with no `..` in it.
  'meta-text': new RegExp(`[^${WSX}][^\\n]*[^${WSX}]|[^${WSX}]`),
};

const INLINE_META = {
  pattern: new RegExp(`${CM2}[^\\n]*$`, 'm'),
  inside: inlineMetaInside,
};

// Parse Spec "block-continuation": after a block META OBJECT the logical line
// resumes on a line whose first token is SC2 (`;; ..until.. 2020`) — not a fresh
// triple with the subject `;;`. Shares INLINE_META's inner grammar; the leading
// separator is scoped by the wrapper.
const META_CONTINUATION = {
  pattern: new RegExp(`^[${WS}]*${SC2}[${WS}]+(?=${DT2})[^\\n]*$`, 'm'),
  inside: {
    'meta-separator': new RegExp(`^[${WS}]*${SC2}`),
    ...inlineMetaInside,
  },
};

// ── A triple line's inner grammar ─────────────────────────────────
const tripleInside = {
  'inline-meta': INLINE_META,
  'subject': {
    pattern: new RegExp(`(^[${WS}]*)(${CMD}|${NAME_SUBJ})(?=[${WS}]*(?:${DT2}|${QUAD}))`, 'm'),
    lookbehind: true,
    inside: { 'command': new RegExp(`^${CMD}$`) },
  },
  // Object := TextExcept{NL,CM2} — it MAY contain `..` (20-object-dotdot), so
  // it runs to end of line or to a `,,`.
  //
  // The lookbehind spans from LINE START through the closing marker, not just
  // the marker itself. Anchoring to "some `..`" is ambiguous in both
  // directions: matching the FIRST marker swallows the relation
  // (`project .. Code Red`, case 16), while letting `relation` go first steals
  // an object that contains `..` (`http://h/x..y`, case 20). Requiring the
  // whole `subject .. relation ..` prefix pins it to the closing marker.
  'object': {
    pattern: new RegExp(
      `(^[${WS}]*${NO_DT2}(?:${QUAD}|${DT2}${NO_DT2}${DT2})[${WS}]+)(${NAME_OBJ})(?=[${WS}]*(?:$|${CM2}))`,
      'm',
    ),
    lookbehind: true,
    inside: { 'command': new RegExp(`^${CMD}$`) },
  },
  'relation': {
    pattern: new RegExp(`(${DT2}[${WS}]*)(${CMD}|${NAME_REL})(?=[${WS}]*${DT2})`),
    lookbehind: true,
    inside: { 'command': new RegExp(`^${CMD}$`) },
  },
  'doubledot': new RegExp(`${QUAD}|${DT2}`),
};

// ── Multi-line regions ────────────────────────────────────────────
const EXCLUDED_REGION = {
  pattern: new RegExp(
    `^[^\\n]*(?:ddot\\.it/off|!!off)(?![^${WSX}?#])[^\\n]*$\\n(?:[^\\n]*\\n)*?[^\\n]*(?:ddot\\.it/on|!!on)(?![^${WSX}?#])[^\\n]*$`,
    'm',
  ),
  inside: {
    // The off/on lines themselves: only the command is coloured, the host
    // comment decoration around it (`<!--`, `-->`, `#`) stays unscoped. The
    // wrapper type is deliberately not a canonical role — it exists so the
    // decoration is NOT swept up by the `excluded` catch-all below.
    'directive-line': {
      pattern: new RegExp(`^[^\\n]*(?:ddot\\.it/(?:off|on)|!!(?:off|on))(?![^${WSX}?#])[^\\n]*$`, 'm'),
      inside: {
        'command': new RegExp(`(?:ddot\\.it/(?:off|on)|!!(?:off|on))(?![^${WSX}?#])`),
      },
    },
    'excluded': /[^\n]+/,
  },
};

// A `!!block` body, terminated by the first blank line. The opener may fill the
// Subject, Object or MetaObject position (block-as-field); each is a whole-line
// pattern followed by the body.
const blockRegion = (openerSrc, openerInside) => ({
  pattern: new RegExp(`^${openerSrc}[${WS}]*$\\n(?:[^\\n]*[^${WSX}][^\\n]*\\n)*`, 'm'),
  inside: {
    'block-opener': {
      pattern: new RegExp(`^[^\\n]*${BLOCK}[${WS}]*$`, 'm'),
      inside: openerInside,
    },
    'verbatim': /[^\n]+/,
  },
});

const BLOCK_SUBJECT = blockRegion(`[${WS}]*${BLOCK}`, {
  'command': new RegExp(BLOCK),
});
const BLOCK_OBJECT = blockRegion(
  `[${WS}]*[^\\n]*?${DT2}[^\\n]*?${DT2}[${WS}]*${BLOCK}`,
  tripleInside,
);
// Covers BOTH `,, ..rel.. !!block` (meta object) and `,, !!block` (meta text) —
// block-as-field's 3rd and 4th positions. The explicit `command` rule must come
// first: without it INLINE_META's `meta-text` rule swallows a bare `!!block`.
const BLOCK_META_OBJECT = blockRegion(
  `[${WS}]*[^\\n]*?${CM2}[^\\n]*?${BLOCK}`,
  { 'command': new RegExp(`${BLOCK}[${WS}]*$`), 'inline-meta': INLINE_META, ...tripleInside },
);

// A `,,` block: opener line (or standalone `,,`), body lines, closing `,,`.
const metaBlockInside = {
  'meta-delim': new RegExp(`^[${WS}]*${CM2}[${WS}]*$`, 'm'),
  'meta-relation': {
    pattern: new RegExp(`(${DT2}[${WS}]*)(${NAME_REL})(?=[${WS}]*${DT2})`),
    lookbehind: true,
  },
  'meta-object': {
    pattern: new RegExp(`(${QUAD}[${WS}]+|${DT2}[${WS}]+)([^${WSX}][^\\n]*?)(?=[${WS}]*$)`, 'm'),
    lookbehind: true,
  },
  'meta-doubledot': new RegExp(`${QUAD}|${DT2}`),
  'meta-text': new RegExp(`[^${WSX}][^\\n]*[^${WSX}]|[^${WSX}]`),
};

// Opened by a triple line ending in `,,`. The opener's own slots are scoped by
// a nested region so they do not get meta-* scopes.
const TRIPLE_META_BLOCK = {
  pattern: new RegExp(
    `^[${WS}]*${GATE}[^\\n]*${CM2}[${WS}]*$\\n(?:[^\\n]*\\n)*?[${WS}]*${CM2}[${WS}]*$`,
    'm',
  ),
  inside: {
    'triple-head': {
      pattern: new RegExp(`^[^\\n]*${CM2}[${WS}]*$`, 'm'),
      inside: {
        'meta-delim': new RegExp(`${CM2}[${WS}]*$`, 'm'),
        ...tripleInside,
      },
    },
    ...metaBlockInside,
  },
};

// Standalone `,,` — opens a block after an already-complete triple line.
const STANDALONE_META_BLOCK = {
  pattern: new RegExp(`^[${WS}]*${CM2}[${WS}]*$\\n(?:[^\\n]*\\n)*?[${WS}]*${CM2}[${WS}]*$`, 'm'),
  inside: metaBlockInside,
};

// A gated triple line, with no multi-line region involved.
const TRIPLE_LINE = {
  pattern: new RegExp(`^[${WS}]*${GATE}[^\\n]*$`, 'm'),
  inside: tripleInside,
};

// ── Top-level grammar (order matters: widest regions first) ───────
Prism.languages['ddot.it'] = {
  'excluded-region': EXCLUDED_REGION,
  'block-meta-object-region': BLOCK_META_OBJECT,
  'block-object-region': BLOCK_OBJECT,
  'block-subject-region': BLOCK_SUBJECT,
  'triple-meta-block-region': TRIPLE_META_BLOCK,
  'meta-block-region': STANDALONE_META_BLOCK,
  // Before 'triple-line', which would claim the line with the subject `;;`.
  'meta-continuation': META_CONTINUATION,
  'triple-line': TRIPLE_LINE,
};

Prism.languages.ddot = Prism.languages['ddot.it'];
Prism.languages.ddotit = Prism.languages['ddot.it'];

export default Prism.languages['ddot.it'];
