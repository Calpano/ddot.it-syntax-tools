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
