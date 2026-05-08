#!/usr/bin/env node
// Pack each to-be-published package, install into a throwaway consumer
// dir (one per ecosystem), and exercise it from a fresh-install
// perspective. Catches:
//   * `file:` deps left over in published metadata,
//   * exports / main field mistakes,
//   * postinstall hooks that don't run from a tarball,
//   * peer-dep mismatches,
//   * gemspec / pyproject.toml / entry-point misconfigurations.
//
// Three phases, each in its own temp dir:
//   1. npm tarballs  — textmate-grammar, shiki, highlightjs, prismjs.
//   2. Ruby gem      — rouge-ddot, installed into a private GEM_HOME.
//   3. Python wheel  — pygments-ddot, installed into a venv.
//
// Exits non-zero on the first failure.

import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts });
}

function shInherit(cmd, opts = {}) {
  return execSync(cmd, { stdio: ["ignore", "inherit", "inherit"], ...opts });
}

const cleanups = [];
function cleanup() {
  for (const fn of cleanups) {
    try { fn(); } catch {}
  }
}
process.on("exit", cleanup);

// ── Phase 1: npm packages ─────────────────────────────────────────

function phaseNpm() {
  console.log("\n=== phase 1: npm tarballs ===");
  const PACKAGES = [
    { name: "@calpano/ddot-textmate-grammar", dir: "textmate" },
    { name: "@calpano/ddot-shiki",            dir: "shiki" },
    { name: "@calpano/ddot-highlightjs",      dir: "highlightjs" },
    { name: "@calpano/ddot-prismjs",          dir: "prismjs" },
  ];

  const tarballs = [];
  for (const pkg of PACKAGES) {
    const cwd = join(repoRoot, pkg.dir);
    const out = sh("npm pack --json", { cwd });
    const info = JSON.parse(out);
    const tgz = resolve(cwd, info[0].filename);
    tarballs.push({ ...pkg, tgz });
    cleanups.push(() => rmSync(tgz, { force: true }));
    console.log(`pack    ${pkg.name} → ${tgz}`);
  }

  const consumer = mkdtempSync(join(tmpdir(), "ddot-publish-test-npm-"));
  cleanups.push(() => rmSync(consumer, { recursive: true, force: true }));
  console.log(`consumer dir: ${consumer}`);

  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "ddot-publish-test", version: "0.0.0", type: "module", private: true }, null, 2),
  );

  const installArgs = [
    ...tarballs.map((t) => t.tgz),
    "highlight.js",
    "prismjs",
    "shiki",
  ];
  console.log("npm install (tarballs + peer deps)…");
  shInherit(`npm install --no-audit --no-fund --no-progress ${installArgs.map((a) => `"${a}"`).join(" ")}`, { cwd: consumer });

  const SAMPLE = "Project Eagle ..started in.. 2024";
  const smoke = `
import assert from "node:assert/strict";

console.log("--- @calpano/ddot-textmate-grammar ---");
{
  const mod = await import("@calpano/ddot-textmate-grammar");
  const g = mod.loadGrammar();
  assert.equal(mod.name, "ddot.it");
  assert.equal(mod.scopeName, "source.ddot");
  assert.equal(g.scopeName, "source.ddot");
  assert.ok(Array.isArray(g.patterns) && g.patterns.length > 0);
  console.log("ok");
}

console.log("--- @calpano/ddot-shiki ---");
{
  const ddot = (await import("@calpano/ddot-shiki")).default;
  const shiki = await import("shiki");
  const h = await shiki.createHighlighter({ themes: ["github-light"], langs: [ddot] });
  const tokens = h.codeToTokensBase(${JSON.stringify(SAMPLE)}, { lang: "ddot.it", includeExplanation: "scopeName" });
  const allScopes = tokens.flat().flatMap(t => (t.explanation ?? []).flatMap(e => e.scopes.map(s => s.scopeName)));
  for (const s of ["entity.name.subject.ddot","entity.name.relation.ddot","entity.name.object.ddot","entity.name.operator.ddot"]) {
    assert.ok(allScopes.includes(s), "shiki: scope " + s + " missing");
  }
  console.log("ok");
}

console.log("--- @calpano/ddot-highlightjs ---");
{
  const hljs = (await import("highlight.js/lib/core")).default;
  const lang = (await import("@calpano/ddot-highlightjs")).default;
  hljs.registerLanguage("ddot.it", lang);
  const r = hljs.highlight(${JSON.stringify(SAMPLE)}, { language: "ddot.it" });
  for (const cls of ["hljs-subject","hljs-operator","hljs-relation","hljs-object"]) {
    assert.ok(r.value.includes(cls), "hljs: " + cls + " missing in: " + r.value);
  }
  console.log("ok");
}

console.log("--- @calpano/ddot-prismjs ---");
{
  const Prism = (await import("prismjs")).default;
  await import("@calpano/ddot-prismjs");
  assert.ok(Prism.languages["ddot.it"], "prism: language not registered");
  const html = Prism.highlight(${JSON.stringify(SAMPLE)}, Prism.languages["ddot.it"], "ddot.it");
  for (const cls of ["token subject","token operator","token relation","token object"]) {
    assert.ok(html.includes(cls), "prism: '" + cls + "' missing in: " + html);
  }
  console.log("ok");
}
`;
  writeFileSync(join(consumer, "smoke.mjs"), smoke);
  shInherit("node smoke.mjs", { cwd: consumer });
}

// ── Phase 2: Rouge gem ────────────────────────────────────────────

function phaseRubyGem() {
  console.log("\n=== phase 2: rouge-ddot gem ===");
  const rougeDir = join(repoRoot, "rouge");

  // Clean any stale .gem files first.
  for (const f of readdirSync(rougeDir).filter((f) => f.endsWith(".gem"))) {
    rmSync(join(rougeDir, f));
  }

  shInherit("gem build rouge-ddot.gemspec", { cwd: rougeDir });

  const gemFile = readdirSync(rougeDir).find((f) => f.endsWith(".gem"));
  if (!gemFile) throw new Error("gem build produced no .gem file");
  const gemPath = join(rougeDir, gemFile);
  cleanups.push(() => rmSync(gemPath, { force: true }));
  console.log(`built  ${gemFile}`);

  const gemHome = mkdtempSync(join(tmpdir(), "ddot-publish-test-gem-"));
  cleanups.push(() => rmSync(gemHome, { recursive: true, force: true }));
  console.log(`gem home: ${gemHome}`);

  // Install into private GEM_HOME. Pulls `rouge` runtime dep from rubygems.org.
  shInherit(
    `gem install --install-dir "${gemHome}" --bindir "${gemHome}/bin" --no-document "${gemPath}"`,
    {},
  );

  // Smoke test: load rouge-ddot from the installed gem, lex a sample.
  const ruby = `
require 'rouge'
require 'rouge/lexers/ddot'

lexer = Rouge::Lexers::Ddot.new
src = "Project Eagle ..started in.. 2024"
tokens = lexer.lex(src).to_a
qualnames = tokens.map { |tok, _| tok.qualname }
must = ["Name.Class", "Operator", "Name.Function", "Literal.String.Symbol"]
must.each do |q|
  raise "rouge: missing #{q} (got: #{qualnames.uniq})" unless qualnames.include?(q)
end
puts "ok"
`;
  const rubyFile = join(gemHome, "smoke.rb");
  writeFileSync(rubyFile, ruby);

  shInherit(
    `ruby "${rubyFile}"`,
    {
      env: {
        ...process.env,
        GEM_HOME: gemHome,
        GEM_PATH: gemHome,
      },
    },
  );
}

// ── Phase 3: Pygments wheel ───────────────────────────────────────

function phasePythonWheel() {
  console.log("\n=== phase 3: pygments-ddot wheel ===");
  const pygDir = join(repoRoot, "pygments");
  const wheelDir = mkdtempSync(join(tmpdir(), "ddot-publish-test-wheel-"));
  cleanups.push(() => rmSync(wheelDir, { recursive: true, force: true }));

  console.log("creating venv…");
  const venv = mkdtempSync(join(tmpdir(), "ddot-publish-test-venv-"));
  cleanups.push(() => rmSync(venv, { recursive: true, force: true }));
  shInherit(`python3 -m venv "${venv}"`);

  // Host pip on macOS Command Line Tools is 21.2 which mishandles
  // pyproject.toml — produces an "UNKNOWN-0.0.0" wheel. Upgrade pip
  // and install the modern `build` tool inside the venv before
  // building the wheel from source.
  console.log("upgrading pip + installing build…");
  shInherit(`"${venv}/bin/python" -m pip install --quiet --upgrade pip build`);

  console.log("python -m build…");
  shInherit(
    `"${venv}/bin/python" -m build --wheel --outdir "${wheelDir}" .`,
    { cwd: pygDir },
  );
  // `python -m build` leaves build/ and *.egg-info/ in the source dir.
  cleanups.push(() => {
    rmSync(join(pygDir, "build"), { recursive: true, force: true });
    for (const f of readdirSync(pygDir).filter((n) => n.endsWith(".egg-info"))) {
      rmSync(join(pygDir, f), { recursive: true, force: true });
    }
  });
  const wheel = readdirSync(wheelDir).find((f) => f.endsWith(".whl"));
  if (!wheel) throw new Error("python -m build produced no .whl file");
  console.log(`built  ${wheel}`);

  console.log("pip install (wheel + Pygments dep)…");
  shInherit(`"${venv}/bin/pip" install --quiet "${join(wheelDir, wheel)}"`);

  // Smoke test: load via Pygments' entry-point lookup, tokenize, assert.
  const py = `
import sys
from pygments.lexers import get_lexer_by_name
from pygments.token import Name, Operator, Literal

lexer = get_lexer_by_name("ddot")
print("loaded:", lexer.__class__.__module__, lexer.__class__.__name__)
src = "Project Eagle ..started in.. 2024"
tokens = list(lexer.get_tokens(src))
types = {t for t, _ in tokens}
must = [Name.Class, Name.Function, Literal.String.Symbol, Operator]
missing = [t for t in must if t not in types]
if missing:
    print("missing tokens:", missing, "got:", types, file=sys.stderr)
    sys.exit(1)
print("ok")
`;
  const pyFile = join(venv, "smoke.py");
  writeFileSync(pyFile, py);
  shInherit(`"${venv}/bin/python" "${pyFile}"`);
}

// ── Run ────────────────────────────────────────────────────────────

try {
  phaseNpm();
  phaseRubyGem();
  phasePythonWheel();
  console.log("\nall to-be-published packages installable and functional from packed artefacts");
} catch (err) {
  console.error("\nPUBLISH-TEST FAILED");
  if (err.stdout) console.error(err.stdout.toString());
  if (err.stderr) console.error(err.stderr.toString());
  process.exit(1);
}
