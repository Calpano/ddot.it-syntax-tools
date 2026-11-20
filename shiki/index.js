// Shiki language registration for ddot.it.
//
// Shiki accepts a `LangRegistration` object — a TextMate grammar plus a few
// metadata fields. We thinly wrap @calpano/ddot-textmate-grammar so any
// Shiki highlighter can pick up ddot.it without re-defining rules.
//
// Usage:
//   import { createHighlighter } from "shiki";
//   import ddot from "@calpano/ddot-shiki";
//
//   const highlighter = await createHighlighter({
//     themes: ["github-light"],
//     langs: [ddot],
//   });
//   const html = highlighter.codeToHtml(code, { lang: "ddot.it", theme: "github-light" });

import { loadGrammar } from "@calpano/ddot-textmate-grammar";

const grammar = loadGrammar();

/**
 * Shiki LangRegistration: a TextMate grammar with metadata fields shiki uses
 * to resolve `lang: "ddot"` / `lang: ".ddot"` / etc. to this grammar.
 */
export const ddotLanguage = {
  ...grammar,
  name: "ddot.it",
  scopeName: "source.ddot",
  aliases: ["ddot", "ddotit"],
  fileTypes: ["ddot"],
};

export default ddotLanguage;

/**
 * `code` with every empty line replaced by a single space.
 *
 * Shiki never hands an empty line to the grammar (`if (line === "") continue`
 * in @shikijs/primitive), so the grammar's state cannot change there and a
 * `!!block` that ends at a blank line runs on to the end of the document. A
 * line holding one space is whitespace-only, which is what ends the block, and
 * it does reach the grammar. The rendered output differs only by that
 * invisible space.
 */
export function fillBlankLines(code) {
  return code.replace(/^$/gm, " ");
}

/**
 * Shiki transformer that applies {@link fillBlankLines} before highlighting:
 * pass it in `transformers` so blank-line-terminated `!!block`s end where they
 * should. Shiki runs `preprocess` for `codeToHtml` / `codeToHast`, not for
 * `codeToTokens`; call `fillBlankLines` yourself there.
 */
export const ddotBlankLines = {
  name: "ddot-blank-lines",
  preprocess: fillBlankLines,
};
