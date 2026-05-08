// Prism.js language definition for ddot.it (https://ddot.it).
//
// Prism's tokenizer applies each pattern in priority order, splitting the
// remaining (un-tokenized) text as it goes. `inside` patterns can't reach
// across already-tokenized chunks, so we do everything at the top level
// with `lookbehind: true`: the first capture group is treated as a
// "lookbehind prefix" by Prism — included in the regex match (so JS
// regex lookahead works) but stripped from the token's text and left in
// place for subsequent patterns. This lets us
//   * match `subject` first (lookahead to `..`),
//   * match `relation` next (lookbehind to first `..`, lookahead to
//     second `..`),
//   * match `object` next (lookbehind to last `..`, lookahead to EOL),
//   * and finally let `operator` pick up the `..` markers that were
//     preserved by the slot patterns.
//
// Multi-line regions (off-on span, free-form `,,…,,`, typed-meta region)
// are matched at the very top with their own `inside` grammars.
//
// Token mapping: Prism token names equal canonical names directly.

import Prism from 'prismjs';

// ── Regex source strings ──────────────────────────────────────────
const CMD       = '(?:ddot\\.it(?:/[\\w.\\-]+)?|!![\\w.\\-]*)';
const NAME_SUBJ = '[^\\s.,][^\\n,]*?[^\\s,]';
const NAME_REL  = '[^\\s.,][^\\n.,]*?[^\\s.,]';
const NAME_OBJ  = '[^\\s,][^\\n,]*?[^\\s,]';
const OP_TYPED   = '\\.{2}';
const OP_UNTYPED = '(?:\\.{4}|\\.{2}[ \\t]+\\.{2})';

// Match name-shaped slot, handling 1-char and 2-char edge cases.
// (`[name]?` flavor: first char + optional rest ending in non-ws-non-comma)
const NAME_SUBJ_R = `(?:${NAME_SUBJ}|[^\\s.,])`;
const NAME_REL_R  = `(?:${NAME_REL}|[^\\s.,])`;
const NAME_OBJ_R  = `(?:${NAME_OBJ}|[^\\s,])`;

// ── Multi-line region patterns ────────────────────────────────────

const disabledRegionRe = new RegExp(
  `^[ \\t]*(?:ddot\\.it/off|!!off)[ \\t]*$\\n(?:[^\\n]*\\n)*?[ \\t]*(?:ddot\\.it/on|!!on)[ \\t]*$`,
  'm',
);
const disabledInside = {
  'command': /^[ \t]*(?:ddot\.it\/(?:off|on)|!!(?:off|on))[ \t]*$/m,
  'disabled': /[^\n]+/,
};

const metaTextRegionRe = new RegExp(
  `^[ \\t]*,,[ \\t]*$\\n(?:[^\\n]*\\n)*?[ \\t]*,,[ \\t]*$`,
  'm',
);
const metaTextInside = {
  'meta-delim': /^[ \t]*,,[ \t]*$/m,
  'meta-text':  /[^\n]+/,
};

// Typed meta region — body + closing `,,` ONLY. The opener line (a
// regular triple ending in `,,`) is left for the top-level slot/operator
// patterns to handle. The region is anchored to lines starting with `..`
// or `....`.
const typedMetaRegionRe = new RegExp(
  `^(?:[ \\t]*\\.{2,4}[^\\n]*\\n)+[ \\t]*,,[ \\t]*$`,
  'm',
);
const typedMetaRegionInside = {
  // Closing standalone `,,`.
  'meta-delim':    /^[ \t]*,,[ \t]*$/m,
  // Body-line slots get meta-* scopes.
  'meta-relation': { pattern: new RegExp(`(\\.\\.[ \\t]*)(${NAME_REL_R})(?=[ \\t]*\\.\\.)`),                                         lookbehind: true },
  'meta-object':   { pattern: new RegExp(`(\\.{4}[ \\t]+|\\.\\.[ \\t]+\\.\\.[ \\t]+|\\.\\.[ \\t]+)(${NAME_OBJ_R})(?=[ \\t]*$)`, 'm'), lookbehind: true },
  'meta-operator': /\.{2}/,
};

// ── Top-level grammar ─────────────────────────────────────────────
//
// Order matters:
//   1. Multi-line regions first (they consume large spans).
//   2. `command` second (highest-priority single-token form).
//   3. `subject`, `relation`, `object` (slot positions, anchored by
//      lookbehind/lookahead).
//   4. `operator` last (so the `..` markers it eats are still in the
//      text when slot patterns look back/ahead at them).
//   5. `meta-delim` (`,,`).

Prism.languages['ddot.it'] = {
  'disabled-region': {
    pattern: disabledRegionRe,
    inside: disabledInside,
  },
  'typed-meta-region': {
    pattern: typedMetaRegionRe,
    inside: typedMetaRegionInside,
  },
  'meta-text-region': {
    pattern: metaTextRegionRe,
    inside: metaTextInside,
  },
  // Inline meta tail: `,, .. rel .. obj` at end of a line. The whole tail
  // gets its own region so the `..` inside is scoped meta-operator, not
  // operator.
  'inline-meta-region': {
    pattern: new RegExp(`,,[ \\t]+\\.\\.[ \\t]*${NAME_REL_R}[ \\t]*\\.\\.[ \\t]+${NAME_OBJ_R}[ \\t]*$`, 'm'),
    inside: {
      'meta-delim':    /^,,/,
      'meta-relation': { pattern: new RegExp(`(\\.\\.[ \\t]*)(${NAME_REL_R})(?=[ \\t]*\\.\\.)`), lookbehind: true },
      'meta-object':   { pattern: new RegExp(`(\\.\\.[ \\t]+)(${NAME_OBJ_R})(?=[ \\t]*$)`, 'm'), lookbehind: true },
      'meta-operator': /\.{2}/,
    },
  },
  // Single-token primaries.
  'command': new RegExp(CMD),
  // Slot positions.
  'subject': {
    pattern: new RegExp(`(^[ \\t]*)(${NAME_SUBJ_R})(?=[ \\t]*\\.\\.)`, 'm'),
    lookbehind: true,
  },
  'relation': {
    pattern: new RegExp(`(\\.\\.[ \\t]*)(${NAME_REL_R})(?=[ \\t]*\\.\\.)`),
    lookbehind: true,
  },
  'object': {
    pattern: new RegExp(`(\\.{4}[ \\t]+|\\.\\.[ \\t]+\\.\\.[ \\t]+|\\.\\.[ \\t]+)(${NAME_OBJ_R})(?=[ \\t]*(?:$|,,))`, 'm'),
    lookbehind: true,
  },
  'operator':   /\.{4}|\.{2}[ \t]+\.{2}|\.{2}/,
  'meta-delim': /,,/,
};

Prism.languages.ddot   = Prism.languages['ddot.it'];
Prism.languages.ddotit = Prism.languages['ddot.it'];

export default Prism.languages['ddot.it'];
