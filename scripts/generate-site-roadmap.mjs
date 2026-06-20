#!/usr/bin/env node
/**
 * Generates dynamic sections of apps/web/roadmap.html from manifests/workspace-status.json.
 * Sections are delimited by <!-- rm:gen:NAME --> / <!-- /rm:gen:NAME --> sentinel comments.
 * Narrative content (milestone bullet points, phase descriptions) stays hand-edited.
 *
 * Usage:
 *   node scripts/generate-site-roadmap.mjs generate   # write roadmap.html in-place
 *   node scripts/generate-site-roadmap.mjs check      # exit 1 if roadmap.html is out of sync
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Lint milestone plan ──────────────────────────────────────────────────────
// State (done/active/upcoming) is derived from workspace-status.json at runtime.
// Titles and upcoming card descriptions are owned here.
const LINT_PLAN = [
  { ver: 'v0.1', name: 'Bootstrap' },
  { ver: 'v0.2', name: 'Convention rules' },
  { ver: 'v0.3', name: 'Framework configs' },
  { ver: 'v0.4', name: 'Security rules', cardTitle: 'Security rules + first auto-fixer' },
  { ver: 'v0.5', name: 'Module quality', cardTitle: 'Module-boundary + quality rules' },
  {
    ver: 'v0.6',
    name: 'Type-safety',
    upcomingTitle: 'Type-safety rules',
    upcomingDesc:
      '<code>no-type-assertion-to-any</code>, <code>no-non-null-assertion</code>, ' +
      '<code>react-hook-naming</code>, <code>nest-controller-response-type</code>, ' +
      '<code>recommended</code> config.',
  },
  {
    ver: 'v1.0',
    name: 'Stable catalog',
    upcomingTitle: 'Stable catalog',
    upcomingDesc:
      '~20 rules documented. All configs complete. Migration guide. ' +
      'CI linting of <code>@nekostack/schema</code> with <code>/strict</code>.',
  },
];

const TOTAL_PACKAGES = 108;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseMinorVer(s) {
  const m = s.match(/(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2]] : [0, 0];
}

/** Returns true if planVer (e.g. "v0.5") ≤ releaseTag (e.g. "lint-v0.5.0"). */
function isVerShipped(planVer, releaseTag) {
  const [pa, pb] = parseMinorVer(planVer);
  const [ra, rb] = parseMinorVer(releaseTag);
  return pa < ra || (pa === ra && pb <= rb);
}

function normalizeEol(s) {
  return s.replace(/\r\n/g, '\n');
}

function replaceSentinel(html, name, content, inline = false) {
  const open = `<!-- rm:gen:${name} -->`;
  const close = `<!-- /rm:gen:${name} -->`;
  const si = html.indexOf(open);
  const ei = html.indexOf(close);
  if (si === -1) throw new Error(`Sentinel not found in roadmap.html: rm:gen:${name}`);
  if (ei === -1) throw new Error(`Sentinel not found in roadmap.html: /rm:gen:${name}`);
  const sep = inline ? '' : '\n';
  return html.slice(0, si + open.length) + sep + content + sep + html.slice(ei);
}

/** Derives a sentinel key from a version string: "v0.1" → "v0-1", "v1.0" → "v1-0" */
function verKey(ver) {
  return ver.replace(/\./g, '-');
}

// ─── Load SSOT ────────────────────────────────────────────────────────────────
const status = JSON.parse(
  readFileSync(join(root, 'manifests/workspace-status.json'), 'utf8'),
);

// Package counts for progress strip
const shippedPkgs = status.packages.filter(
  (p) => p.latest_release && parseMinorVer(p.latest_release)[0] >= 1,
);
const inProgressPkgs = status.packages.filter(
  (p) => p.latest_release && parseMinorVer(p.latest_release)[0] < 1,
);
const shippedCount = shippedPkgs.length;
const inProgressCount = inProgressPkgs.length;
const plannedCount = TOTAL_PACKAGES - shippedCount - inProgressCount;
const barPct = ((shippedCount / TOTAL_PACKAGES) * 100).toFixed(2);

// Lint package
const lintPkg = status.packages.find((p) => p.name === '@nekostack/lint');
const lintLatestTag = lintPkg?.latest_release ?? null; // "lint-v0.5.0"
const lintLatestDate = lintPkg?.latest_release_date ?? null;

// Classify each lint milestone
const lintMilestones = LINT_PLAN.map((m, i) => {
  const done = lintLatestTag ? isVerShipped(m.ver, lintLatestTag) : false;
  const active =
    !done &&
    (i === 0 || isVerShipped(LINT_PLAN[i - 1].ver, lintLatestTag ?? 'lint-v0.0.0'));
  return { ...m, state: done ? 'done' : active ? 'active' : 'upcoming' };
});

const lintShippedMilestones = lintMilestones.filter((m) => m.state === 'done');
const lintActiveMilestone = lintMilestones.find((m) => m.state === 'active');
const lintUpcomingMilestones = lintMilestones.filter((m) => m.state === 'upcoming');

// Badge text: "@nekostack/lint v0.5 ✓ — v0.6 next"
const activeShortVer = lintLatestTag
  ? lintLatestTag.replace('lint-', '').replace(/\.0$/, '')
  : null;
const nextVer = lintActiveMilestone?.ver ?? null;
const badgeText =
  activeShortVer && nextVer
    ? `@nekostack/lint ${activeShortVer} ✓ — ${nextVer} next`
    : '@nekostack/lint in progress';

// ─── Styling constants ────────────────────────────────────────────────────────
const S_BORDER =
  'border-color: color-mix(in srgb, var(--neko-color-semantic-success) 25%, transparent);';
const S_VER = 'color: var(--neko-color-semantic-success);';
const S_TAG =
  'color: var(--neko-color-semantic-success); ' +
  'background: color-mix(in srgb, var(--neko-color-semantic-success) 10%, transparent); ' +
  'border-color: color-mix(in srgb, var(--neko-color-semantic-success) 25%, transparent);';

// ─── Fragment generators ───────────────────────────────────────────────────────
function genHeroBadges() {
  return [
    `        <span class="neko-badge neko-badge--success neko-badge--pill">${shippedCount} shipped</span>`,
    `        <span class="neko-badge neko-badge--warning neko-badge--pill">${badgeText}</span>`,
    `        <span class="neko-badge neko-badge--pill">Apache-2.0</span>`,
  ].join('\n');
}

function genProgressStrip() {
  const pkgsLabel = inProgressCount === 1 ? 'package in progress' : 'packages in progress';
  return [
    `      <div class="progress-strip__stats">`,
    `        <div class="progress-stat">`,
    `          <span class="progress-stat__num progress-stat__num--green">${shippedCount}</span>`,
    `          <span class="progress-stat__label">packages shipped at v1.0+</span>`,
    `        </div>`,
    `        <div class="progress-stat">`,
    `          <span class="progress-stat__num progress-stat__num--amber">${inProgressCount}</span>`,
    `          <span class="progress-stat__label">${pkgsLabel}</span>`,
    `        </div>`,
    `        <div class="progress-stat">`,
    `          <span class="progress-stat__num progress-stat__num--muted">${plannedCount}</span>`,
    `          <span class="progress-stat__label">packages planned</span>`,
    `        </div>`,
    `      </div>`,
    `      <div class="progress-bar-wrap">`,
    `        <div class="progress-bar-track">`,
    `          <div class="progress-bar-fill" style="width: ${barPct}%"></div>`,
    `        </div>`,
    `        <div class="progress-bar-label">${shippedCount} of ${TOTAL_PACKAGES} packages complete</div>`,
    `      </div>`,
  ].join('\n');
}

function genLintPhaseMeta() {
  const verStr = activeShortVer ?? 'in progress';
  const dateStr = lintLatestDate ?? '';
  return `Phase 1 · Package 1 of 4 · ${verStr} shipped ${dateStr}`.trimEnd();
}

function genLintMilestones() {
  return lintMilestones
    .map((m) => {
      const cls =
        m.state === 'done'
          ? ' milestone--done'
          : m.state === 'active'
            ? ' milestone--active'
            : '';
      return [
        `          <div class="milestone${cls}">`,
        `            <div class="milestone__dot"><div class="milestone__dot-inner"></div></div>`,
        `            <div class="milestone__ver">${m.ver}</div>`,
        `            <div class="milestone__name">${m.name}</div>`,
        `          </div>`,
      ].join('\n');
    })
    .join('\n');
}

function genLintCardHeader(m) {
  const title = m.cardTitle ?? m.name;
  if (m.state === 'done') {
    return [
      `        <div class="milestone-detail" style="${S_BORDER}">`,
      `          <div class="milestone-detail__header">`,
      `            <span class="milestone-detail__ver" style="${S_VER}">${m.ver}</span>`,
      `            <span class="milestone-detail__title">${title}</span>`,
      `            <span class="milestone-detail__tag" style="${S_TAG}">✓ Shipped</span>`,
      `          </div>`,
    ].join('\n');
  }
  return [
    `        <div class="milestone-detail">`,
    `          <div class="milestone-detail__header">`,
    `            <span class="milestone-detail__ver">${m.ver}</span>`,
    `            <span class="milestone-detail__title">${title}</span>`,
    `            <span class="milestone-detail__tag">Up next</span>`,
    `          </div>`,
  ].join('\n');
}

function genLintUpcoming() {
  const cards = lintUpcomingMilestones.filter((m) => m.upcomingTitle && m.upcomingDesc);
  if (cards.length === 0) return `        <div class="upcoming-milestones"></div>`;
  const inner = cards
    .map((m) =>
      [
        `          <div class="upcoming-card">`,
        `            <div class="upcoming-card__ver">${m.ver}</div>`,
        `            <div class="upcoming-card__title">${m.upcomingTitle}</div>`,
        `            <div class="upcoming-card__desc">${m.upcomingDesc}</div>`,
        `          </div>`,
      ].join('\n'),
    )
    .join('\n');
  return [`        <div class="upcoming-milestones">`, inner, `        </div>`].join('\n');
}

// ─── Apply all replacements ───────────────────────────────────────────────────
function applyAll(html) {
  html = replaceSentinel(html, 'hero-badges', genHeroBadges());
  html = replaceSentinel(html, 'progress-strip', genProgressStrip());
  html = replaceSentinel(html, 'lint-phase-meta', genLintPhaseMeta(), true);
  html = replaceSentinel(html, 'lint-milestones', genLintMilestones());

  for (const m of lintShippedMilestones) {
    html = replaceSentinel(html, `lint-card-${verKey(m.ver)}-header`, genLintCardHeader(m));
  }
  // Active milestone may or may not have a narrative card yet in the HTML
  if (lintActiveMilestone) {
    const key = `lint-card-${verKey(lintActiveMilestone.ver)}-header`;
    if (html.includes(`<!-- rm:gen:${key} -->`)) {
      html = replaceSentinel(html, key, genLintCardHeader(lintActiveMilestone));
    }
  }

  html = replaceSentinel(html, 'lint-upcoming', genLintUpcoming());
  return html;
}

// ─── Commands ─────────────────────────────────────────────────────────────────
const roadmapPath = join(root, 'apps/web/roadmap.html');

function generate() {
  const raw = readFileSync(roadmapPath, 'utf8');
  const result = applyAll(normalizeEol(raw));
  writeFileSync(roadmapPath, result, 'utf8');
  console.log('Wrote apps/web/roadmap.html');
}

function check() {
  const current = normalizeEol(readFileSync(roadmapPath, 'utf8'));
  const expected = normalizeEol(applyAll(current));
  if (expected !== current) {
    console.error(
      'roadmap:check — drift detected: apps/web/roadmap.html is out of sync with workspace-status.json.\n' +
        'Run `npm run roadmap:generate` to fix.',
    );
    process.exit(1);
  }
  console.log('roadmap:check — OK');
}

const cmd = process.argv[2];
if (cmd === 'generate') generate();
else if (cmd === 'check') check();
else {
  console.error(
    'Usage: node scripts/generate-site-roadmap.mjs [generate|check]',
  );
  process.exit(1);
}
