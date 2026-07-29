#!/usr/bin/env node
/**
 * Conformance for the `parser/` package (@calpano/ddot-parser).
 *
 * Asserts BOTH streams against ../ddot.it/test-data/cases/:
 *   expected.tokens.json  — canonical highlighter tokens (TextMate is canonical)
 *   expected.events.jsonl — triple events (the Java DdotEventExporter is canonical)
 *
 * This package is what ddot.it's vocabulary gate runs, so a divergence here
 * would silently change what that gate accepts.
 *
 *   node tools/conformance-parser.mjs
 *   npm run conformance:parser
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const cases = resolve(repo, '../ddot.it/test-data/cases');

const { tokenize, toJson, parseEvents, toJsonl } = await import(resolve(repo, 'parser/index.js'));

if (!existsSync(cases)) {
  console.warn(`[parser] ${cases} not found — clone Calpano/ddot.it beside this repo. Skipping.`);
  process.exit(0);
}

let failed = 0;
let checked = 0;
for (const name of readdirSync(cases).sort()) {
  const dir = join(cases, name);
  const input = join(dir, 'input.ddot');
  if (!existsSync(input)) continue;
  const src = readFileSync(input, 'utf8');
  const problems = [];

  const tokPath = join(dir, 'expected.tokens.json');
  if (existsSync(tokPath)) {
    const want = readFileSync(tokPath, 'utf8');
    const got = toJson(tokenize(src));
    if (want !== got) problems.push(['tokens', want, got]);
  }
  const evPath = join(dir, 'expected.events.jsonl');
  if (existsSync(evPath)) {
    const want = readFileSync(evPath, 'utf8');
    const got = toJsonl(parseEvents(src, 'ddot', 'input.ddot'));
    if (want !== got) problems.push(['events', want, got]);
  }

  checked++;
  if (problems.length === 0) {
    console.log(`ok    ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
    for (const [what, want, got] of problems) {
      console.log(`  ${what}:`);
      console.log(`    expected: ${JSON.stringify(want).slice(0, 200)}`);
      console.log(`    actual:   ${JSON.stringify(got).slice(0, 200)}`);
    }
  }
}

console.log(failed ? `\n${failed}/${checked} case(s) diverge` : `\nall ${checked} cases pass`);
process.exit(failed ? 1 : 0);
