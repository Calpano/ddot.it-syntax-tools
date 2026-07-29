#!/usr/bin/env node
// ddot-index — index ddot.it source to `.ddot` triple lines.
//
//   ddot-index <file> [-o out.ddot]
//
// Reads the file, extracts every triple, and writes one `s ..p.. o` line each
// (untyped triples use the `....` shorthand). Exit 2 on usage error.
//
// The whole file is parsed: ddot.it is a guest language, so triples are found
// wherever they occur, and `ddot.it/off` … `ddot.it/on` is what gates a
// document that wants only some regions indexed.
import { readFileSync, writeFileSync } from 'node:fs';
import { indexToDdot } from '../index.js';

const args = process.argv.slice(2);
let out = null;
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-o' || a === '--output') out = args[++i];
  else if (a.startsWith('-')) { console.error(`unknown option: ${a}`); process.exit(2); }
  else files.push(a);
}

if (files.length !== 1 || out === undefined) {
  console.error('usage: ddot-index <file> [-o out.ddot]');
  process.exit(2);
}

const text = readFileSync(files[0], 'utf8');
const ddot = indexToDdot(text, { kind: files[0].split('.').pop(), source: files[0] });
if (out) writeFileSync(out, ddot);
else process.stdout.write(ddot);
