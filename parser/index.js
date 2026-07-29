// @calpano/ddot-parser — the canonical JavaScript ddot.it parser.
//
// `tokenize` produces the canonical highlighter token stream; `parseEvents`
// folds those tokens into triple events. Both are asserted against the
// cross-implementation corpus (../ddot.it/test-data/cases/) by this repo's
// `npm run conformance:parser`, the same corpus that pins the TextMate grammar
// and the six highlighter mirrors.
export { tokenize, toJson } from './tokenizer.js';
export { parseEvents, toJsonl } from './events.js';

/**
 * Index ddot.it source to `.ddot` triple lines — the text form used for
 * checked-in indexes such as ddot.it's site/spec/ddot-it-vocabulary.ddot.
 *
 * An untyped triple is written with the QuadDot shorthand, matching how the
 * relation is omitted rather than invented: consumers default it to `links to`.
 */
export function indexToDdot(text, { kind = 'ddot', source = '' } = {}) {
  const lines = parseEventsFor(text, kind, source).map((e) =>
    e.type === undefined ? `${e.from} .... ${e.to}` : `${e.from} ..${e.type}.. ${e.to}`);
  return lines.length ? lines.join('\n') + '\n' : '';
}

import { parseEvents as parseEventsFor } from './events.js';
