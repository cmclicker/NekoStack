#!/usr/bin/env node
// Deterministic production-readiness evaluator for the NekoStack monorepo.
//
// Per package: proven stage (what the repo can prove) vs claimed stage (what the
// version/README assert) + gaps + overstatement flags. Stage model: standards/lifecycle.md.
//
// Modes:
//   (default)  static analysis, report only. Does NOT run build/test.
//   --run      additionally runs build+test per active package for TRUE stage 3/4 proof.
//   --gate     exit 1 if any package OVERSTATES (claimed stage > proven stage). Report still prints.
//
// Same repo -> same result. Judges presence/consistency, NOT quality. The AI cannot talk past it.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const ARGS = new Set(process.argv.slice(2));
const RUN = ARGS.has('--run');
const GATE = ARGS.has('--gate');

const STAGE_NAMES = { 0: 'scaffold', 1: 'spec', 2: 'design', 3: 'implement', 4: 'test', 5: 'audit', 6: 'release' };
const STUB_STATUS = /empty placeholder|not started|formalizing|^scaffold/i;
const SPEC_DOC = /scope|invariant|spec|contract|runner/i;

const tags = (() => {
  try { return execSync('git tag --list', { cwd: ROOT, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean); }
  catch { return []; }
})();
const rootLicense = existsSync(join(ROOT, 'LICENSE'));

function walkCount(dir, match) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) n += walkCount(p, match);
    else if (match(e)) n++;
  }
  return n;
}
const srcExt = (f) => /\.(ts|tsx|css|mjs|js)$/.test(f) && !/\.d\.ts$/.test(f);
const testExt = (f) => /\.(test|test-d|bench)\.(ts|tsx|js)$/.test(f);

function readmeStatus(dir) {
  const f = join(dir, 'README.md');
  if (!existsSync(f)) return null;
  const m = readFileSync(f, 'utf8').match(/\*\*Status\*\*\s*\|\s*([^\n|]+)/i);
  return m ? m[1].trim() : null;
}

function runOk(npmName, script) {
  try {
    execSync(`npm run ${script} -w ${npmName} --if-present`, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function evaluate(dirName) {
  const dir = join(PKGS, dirName);
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const deps = pkg.dependencies || {};
  const version = pkg.version || '0.0.0';
  const major = parseInt(version.split('.')[0], 10) || 0;

  const srcFiles = walkCount(join(dir, 'src'), srcExt);
  const testFiles = walkCount(join(dir, 'tests'), testExt);
  const hasReadme = existsSync(join(dir, 'README.md'));
  const hasChangelog = existsSync(join(dir, 'CHANGELOG.md'));
  const hasDocs = walkCount(join(dir, 'docs'), (f) => f.endsWith('.md')) > 0;
  const specEvidence = walkCount(join(dir, 'docs'), (f) => f.endsWith('.md') && SPEC_DOC.test(f)) > 0;
  const hasBuild = !!scripts.build;
  const hasTestScript = !!scripts.test;
  const isPrivate = pkg.private === true;
  const hasLicenseField = !!pkg.license;
  const status = readmeStatus(dir);
  const isStub = status ? STUB_STATUS.test(status) : false;
  const tag = `${dirName}-v${version}`;
  const tagExists = tags.includes(tag);
  const starDeps = Object.entries(deps).filter(([k, v]) => k.startsWith('@nekostack/') && v === '*').map(([k]) => k);

  // classify
  const depCount = Object.keys(deps).length;
  let type = 'active';
  if (srcFiles === 0 && depCount > 0 && !isPrivate) type = 'meta';
  else if (Object.keys(scripts).length === 0 || srcFiles === 0) type = 'scaffold';

  // optional dynamic proof
  let buildGreen = null, testGreen = null;
  if (RUN && type === 'active') {
    buildGreen = hasBuild ? runOk(pkg.name, 'build') : false;
    testGreen = hasTestScript ? runOk(pkg.name, 'test') : false;
  }

  const gaps = [];
  const flags = [];

  // proven stage
  let proven = 0;
  if (type === 'meta') {
    // a code-free aggregator: "released" needs license + all pinned deps tagged
    const depTags = Object.entries({ ...deps }).filter(([k]) => k.startsWith('@nekostack/'))
      .map(([k, v]) => `${k.replace('@nekostack/', '')}-v${String(v).replace(/^[\^~]/, '')}`);
    const allDepsTagged = depTags.every((t) => tags.includes(t));
    proven = 5;
    if (!isPrivate && hasLicenseField && allDepsTagged) proven = 6;
    if (!allDepsTagged) gaps.push(`pins deps with no matching tag: ${depTags.filter((t) => !tags.includes(t)).join(', ')}`);
  } else if (type === 'active') {
    const implemented = RUN ? buildGreen : hasBuild;
    const tested = RUN ? testGreen : (testFiles >= 1 && hasTestScript);
    proven = implemented ? 3 : 1;
    if (proven >= 3 && tested) proven = 4;
    if (proven >= 4 && hasReadme && hasDocs && !isStub && !(major >= 1 && !tagExists)) proven = 5;
    if (proven >= 5 && !isPrivate && hasLicenseField && hasChangelog && tagExists) proven = 6;

    if (!hasBuild) gaps.push('no build script (stage 3)');
    if (RUN && hasBuild && !buildGreen) gaps.push('build FAILS (stage 3)');
    if (testFiles === 0) gaps.push('no tests (stage 4)');
    if (RUN && hasTestScript && !testGreen) gaps.push('tests FAIL (stage 4)');
    if (!hasDocs) gaps.push('no docs/ (stage 5)');
    if (!specEvidence) gaps.push('no spec/invariants artifact (stages 1-2 unevidenced)');
  }

  // claimed stage (the assertion we hold the package to)
  let claimed = null;
  if (type !== 'scaffold') {
    if (major >= 1) claimed = 6;                 // a 1.x version asserts "released"
    else if (!isStub && type === 'active') claimed = proven; // 0.x honest in-dev: no overclaim
    else claimed = proven;
  }

  // overstatement flags (informational; gate blocks on claimed > proven)
  if (!isPrivate && !hasLicenseField) flags.push(rootLicense ? 'publishable but no "license" field' : 'publishable but NO license anywhere');
  if (major >= 1 && !tagExists && type !== 'meta') flags.push(`version ${version} but no git tag "${tag}"`);
  if (isStub && srcFiles > 5) flags.push(`README understates ("${status}") vs ${srcFiles} src files`);
  if (starDeps.length) flags.push(`publish-unsafe "*" dep: ${starDeps.join(', ')}`);
  if (!isPrivate && !hasChangelog && type !== 'meta') flags.push('publishable but no CHANGELOG');

  const overstated = claimed != null && claimed > proven;
  return { name: dirName, type, version, isPrivate, srcFiles, testFiles, proven, claimed, overstated, gaps, flags };
}

const results = readdirSync(PKGS)
  .filter((d) => statSync(join(PKGS, d)).isDirectory())
  .map(evaluate)
  .filter(Boolean);

const active = results.filter((r) => r.type === 'active').sort((a, b) => Number(b.overstated) - Number(a.overstated) || b.proven - a.proven || a.name.localeCompare(b.name));
const metas = results.filter((r) => r.type === 'meta');
const scaffolds = results.filter((r) => r.type === 'scaffold');
const overstatements = results.filter((r) => r.overstated);

console.log(`\nNekoStack readiness — ${results.length} packages   [${RUN ? 'DYNAMIC: runs build/test' : 'static; does not run build/test'}]`);
console.log(`Root LICENSE present: ${rootLicense ? 'yes' : 'NO'}\n`);

const show = (r) => {
  const claim = r.claimed != null ? `  claims:${r.claimed}` : '';
  const bang = r.overstated ? '  ⚠ OVERSTATED' : '';
  console.log(`  ${r.name}  v${r.version}  →  proven ${r.proven} (${STAGE_NAMES[r.proven]})${claim}${bang}   src:${r.srcFiles} tests:${r.testFiles}${r.isPrivate ? '  [private]' : ''}`);
  for (const g of r.gaps) console.log(`        gap   ${g}`);
  for (const f of r.flags) console.log(`        FLAG  ${f}`);
};

console.log('META PACKAGES:\n');
metas.forEach(show);
console.log('\nACTIVE PACKAGES (overstatements first):\n');
active.forEach(show);
console.log(`\nSCAFFOLDS (stage 0): ${scaffolds.length} — ${scaffolds.map((r) => r.name).join(', ')}\n`);

const byStage = {};
for (const r of results) byStage[r.proven] = (byStage[r.proven] || 0) + 1;
console.log('SUMMARY by proven stage:');
for (const s of Object.keys(STAGE_NAMES)) console.log(`  stage ${s} (${STAGE_NAMES[s].padEnd(9)}): ${byStage[s] || 0}`);

if (GATE) {
  console.log('');
  if (overstatements.length) {
    console.log(`GATE: FAIL — ${overstatements.length} package(s) claim a higher stage than they can prove:`);
    for (const r of overstatements) console.log(`  ✗ ${r.name}: claims ${r.claimed} (${STAGE_NAMES[r.claimed]}), proves ${r.proven} (${STAGE_NAMES[r.proven]})`);
    console.log('\nResolve by either raising the proof (tag/license/docs) or lowering the claim (version/README).');
    process.exit(1);
  }
  console.log('GATE: PASS — no package overstates its readiness.');
}
console.log('');
