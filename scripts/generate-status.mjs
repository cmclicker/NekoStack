#!/usr/bin/env node
// Generator: produces manifests/workspace-status.json and docs/STATUS.md from
// hand-edited manifests/workspace.config.json + per-package ROADMAP/CHANGELOG +
// `git tag` output. Run via `npm run status:generate`. Drift-check via
// `npm run status:check`.
//
// Implemented as plain .mjs (no devDep, no transpile) — small, inspectable,
// no moving parts. Promote into @nekostack/registry when this needs shared
// types with a package, multiple consumers, or domain logic that belongs to
// a package's boundary — not because of line count. See scripts/README.md.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { argv, cwd, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(REPO_ROOT, "manifests", "workspace.config.json");
const MANIFEST_PATH = join(REPO_ROOT, "manifests", "workspace-status.json");
const STATUS_PATH = join(REPO_ROOT, "docs", "STATUS.md");
const GH_REPO = "cmclicker/NekoStack";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function gitTags(prefix) {
  const raw = execFileSync(
    "git",
    ["tag", "--list", `${prefix}*`],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort(semverCompare);
}

function semverCompare(a, b) {
  const ax = a.match(/(\d+)\.(\d+)\.(\d+)/);
  const bx = b.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!ax || !bx) return a.localeCompare(b);
  for (let i = 1; i <= 3; i++) {
    const d = Number(ax[i]) - Number(bx[i]);
    if (d !== 0) return d;
  }
  return a.localeCompare(b);
}

function parseActiveTarget(roadmapText) {
  // Match a phase heading whose marker indicates it is the current focus.
  // Two markers are equivalent for active-target purposes:
  //   `← *active target*`                       — pre-merge state on main
  //   `← *candidate implementation in progress*` — mid-flight on a candidate branch
  // The status layer must understand both so a branch can honestly say "not
  // shipped yet" without `status:check` losing track of which phase is current.
  // The shipped-state row never carries either marker — it just records the
  // tag/date — so this regex only picks up the still-being-worked phase.
  const re = /^##\s+(.+?)\s+←\s+\*(?:active target|candidate implementation in progress)\*\s*$/m;
  const m = roadmapText.match(re);
  return m ? m[1].trim() : null;
}

function parseChangelogEntries(changelogText, tagPrefix) {
  // Top-level entries look like:
  //   ## schema-v0.5.0 — 2026-05-17
  //
  //   [Tag](...) · merge commit [`abc1234`](...). <summary sentence>
  //
  //   ### Test count
  //   - 248 → 342 (+94 net).
  //
  // Returns Map<tag, { date, summary, testCount }>.
  const out = new Map();
  const headingRe = new RegExp(
    `^##\\s+(${escapeRegex(tagPrefix)}\\d+\\.\\d+\\.\\d+)\\s+—\\s+(\\d{4}-\\d{2}-\\d{2})\\s*$`,
    "gm",
  );
  const headings = [...changelogText.matchAll(headingRe)];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index : changelogText.length;
    const body = changelogText.slice(start, end);
    out.set(headings[i][1], {
      date: headings[i][2],
      summary: extractSummary(body),
      testCount: extractTestCount(body),
    });
  }
  return out;
}

function extractSummary(body) {
  // First non-empty paragraph after the heading. Strip the canonical
  // "[Tag](url) · merge commit [`hash`](url)." prefix, then take the first
  // sentence of what's left. A sentence terminator is `.`, `!`, or `?`
  // followed by whitespace+uppercase OR end-of-paragraph — this avoids
  // splitting inside version numbers like `v0.1`.
  const para = body.split(/\r?\n\s*\r?\n/).map((s) => s.trim()).find(Boolean);
  if (!para) return null;
  const stripped = para
    .replace(/^\[Tag\]\([^)]+\)\s*·\s*merge commit\s*\[`[^`]+`\]\([^)]+\)\.\s*/, "")
    .trim();
  if (!stripped) return null;
  const m = stripped.match(/^[\s\S]+?[.!?](?=\s+[A-Z]|\s*$)/);
  const sentence = m ? m[0] : stripped.split(/\r?\n/)[0];
  return sentence.replace(/\s+/g, " ").trim();
}

function extractTestCount(body) {
  // Look for "### Test count" followed by a bullet whose right-hand integer
  // is the current count, e.g. "- 248 → 342 (+94 net)." or "- 342 passing."
  const section = body.match(/###\s+Test count\s*\n([\s\S]*?)(?:\n###|\n##|$)/);
  if (!section) return null;
  const arrow = section[1].match(/(\d+)\s*(?:→|->)\s*(\d+)/);
  if (arrow) return Number(arrow[2]);
  const single = section[1].match(/(\d+)\s+(?:tests?|passing)/);
  if (single) return Number(single[1]);
  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPackageStatus(pkg) {
  const roadmapText = readText(join(REPO_ROOT, pkg.roadmap));
  const changelogText = readText(join(REPO_ROOT, pkg.changelog));
  const tags = gitTags(pkg.tag_prefix);
  const entries = parseChangelogEntries(changelogText, pkg.tag_prefix);
  const latestRelease = tags.length > 0 ? tags[tags.length - 1] : null;

  const recent = [...tags].reverse();
  const milestones = recent.map((tag) => {
    const entry = entries.get(tag);
    return {
      tag,
      date: entry?.date ?? null,
      summary: entry?.summary ?? null,
    };
  });

  const latestEntry = latestRelease ? entries.get(latestRelease) : null;

  return {
    name: pkg.name,
    dir: pkg.dir,
    latest_release: latestRelease,
    latest_release_date: latestEntry?.date ?? null,
    active_target: parseActiveTarget(roadmapText),
    test_count: latestEntry?.testCount ?? null,
    // Optional editorial annotation (e.g. release-history lineage / context).
    // Lives in workspace.config.json; surfaced in the site history modal.
    note: pkg.note ?? null,
    milestones,
  };
}

function buildManifest(config) {
  const packages = config.packages.map(buildPackageStatus);
  const doctrineExists = existsSync(join(REPO_ROOT, config.doctrine));
  const doctrineTitle = doctrineExists ? firstHeading(readText(join(REPO_ROOT, config.doctrine))) : null;

  return {
    $comment: "GENERATED by scripts/generate-status.mjs — do not edit. Run `npm run status:generate`. Source-of-truth inputs are listed under `generated_from`.",
    generated_from: [
      relative(REPO_ROOT, CONFIG_PATH).replaceAll("\\", "/"),
      ...config.packages.flatMap((p) => [p.roadmap, p.changelog]),
      "git tags",
    ],
    active_workstream: config.active_workstream,
    doctrine: {
      file: config.doctrine,
      title: doctrineTitle,
      present: doctrineExists,
    },
    packages,
    next_actions: config.next_actions ?? [],
  };
}

function firstHeading(text) {
  const m = text.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

function tagUrl(tag) {
  return `https://github.com/${GH_REPO}/releases/tag/${tag}`;
}

function renderStatusMd(manifest) {
  const lines = [];
  lines.push("# NekoStack — Status");
  lines.push("");
  lines.push("> GENERATED by `npm run status:generate`. Do not edit by hand. Drift is enforced by `npm run status:check` — if this file is out of sync with `manifests/workspace.config.json` + the linked ROADMAPs / CHANGELOGs / git tags, that command exits nonzero.");
  lines.push("");
  lines.push("## Active workstream");
  lines.push("");
  lines.push(`- **Package:** ${manifest.active_workstream}`);

  const activePkg = manifest.packages.find((p) => p.name === manifest.active_workstream) ?? manifest.packages[0];
  if (activePkg) {
    if (activePkg.latest_release) {
      lines.push(`- **Latest release:** [\`${activePkg.latest_release}\`](${tagUrl(activePkg.latest_release)})${activePkg.latest_release_date ? ` — ${activePkg.latest_release_date}` : ""}`);
    } else {
      lines.push("- **Latest release:** _(none yet)_");
    }
    lines.push(`- **Active target:** ${activePkg.active_target ?? "_(no `← *active target*` marker found in ROADMAP)_"}`);
  }
  if (manifest.doctrine.present) {
    lines.push(`- **Doctrine in force:** [${manifest.doctrine.title ?? manifest.doctrine.file}](../${manifest.doctrine.file})`);
  } else {
    lines.push(`- **Doctrine in force:** _(missing — expected ${manifest.doctrine.file})_`);
  }
  lines.push("");

  lines.push("## Latest milestones");
  lines.push("");
  for (const pkg of manifest.packages) {
    if (pkg.milestones.length === 0) continue;
    lines.push(`### ${pkg.name}`);
    lines.push("");
    lines.push("| Tag | Date | Summary |");
    lines.push("|---|---|---|");
    for (const m of pkg.milestones) {
      lines.push(`| [\`${m.tag}\`](${tagUrl(m.tag)}) | ${m.date ?? "—"} | ${m.summary ?? "—"} |`);
    }
    lines.push("");
  }

  lines.push("## Validation snapshot");
  lines.push("");
  lines.push("Test counts come from each package's most recent CHANGELOG entry. After validating a release, update the package CHANGELOG and run `npm run status:generate`.");
  lines.push("");
  for (const pkg of manifest.packages) {
    if (pkg.test_count == null) {
      lines.push(`- **${pkg.name}:** _(no \`### Test count\` line in latest CHANGELOG entry)_`);
    } else {
      lines.push(`- **${pkg.name}:** ${pkg.test_count} tests recorded (latest: ${pkg.latest_release ?? "n/a"})`);
    }
  }
  lines.push("");

  lines.push("## Next actions");
  lines.push("");
  if (manifest.next_actions.length === 0) {
    lines.push("_(none — edit `manifests/workspace.config.json` → `next_actions`)_");
  } else {
    manifest.next_actions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");

  lines.push("## How to refresh");
  lines.push("");
  lines.push("```");
  lines.push("npm run status:generate   # regenerate manifests/workspace-status.json + docs/STATUS.md");
  lines.push("npm run status:check      # exit nonzero if either file has drifted from its sources");
  lines.push("```");
  lines.push("");
  lines.push("Editorial fields (`active_workstream`, `next_actions`, the active-package list) live in `manifests/workspace.config.json`. Derived fields (latest release, milestones, test count, active target) come from `git tag` + each package's ROADMAP / CHANGELOG.");
  lines.push("");
  return lines.join("\n");
}

function renderManifestJson(manifest) {
  return JSON.stringify(manifest, null, 2) + "\n";
}

function build() {
  const config = readJson(CONFIG_PATH);
  const manifest = buildManifest(config);
  return {
    manifest: renderManifestJson(manifest),
    status: renderStatusMd(manifest),
  };
}

function cmdGenerate() {
  const { manifest, status } = build();
  writeFileSync(MANIFEST_PATH, manifest, "utf8");
  writeFileSync(STATUS_PATH, status, "utf8");
  stdout.write(`Wrote ${relative(cwd(), MANIFEST_PATH).replaceAll("\\", "/")}\n`);
  stdout.write(`Wrote ${relative(cwd(), STATUS_PATH).replaceAll("\\", "/")}\n`);
}

// Normalize line endings before comparing. On Windows with core.autocrlf=true,
// `git checkout` converts committed LF to CRLF in the working tree, while the
// generator always writes canonical LF. Comparing the raw bytes would report
// false drift on those clones. The committed content is LF either way — line
// endings are not load-bearing for this artifact — so the comparison is what
// gets normalized, not the write path.
function normalizeEol(s) {
  return s.replace(/\r\n/g, "\n");
}

function cmdCheck() {
  const { manifest, status } = build();
  const drifts = [];
  if (!existsSync(MANIFEST_PATH) || normalizeEol(readText(MANIFEST_PATH)) !== manifest) {
    drifts.push(relative(cwd(), MANIFEST_PATH).replaceAll("\\", "/"));
  }
  if (!existsSync(STATUS_PATH) || normalizeEol(readText(STATUS_PATH)) !== status) {
    drifts.push(relative(cwd(), STATUS_PATH).replaceAll("\\", "/"));
  }
  if (drifts.length === 0) {
    stdout.write("status:check — clean. STATUS artifacts match their sources.\n");
    return;
  }
  stderr.write("status:check — DRIFT detected. The following files are out of sync with their sources:\n");
  for (const d of drifts) stderr.write(`  - ${d}\n`);
  stderr.write("Run: npm run status:generate\n");
  exit(1);
}

const subcommand = argv[2] ?? "generate";
switch (subcommand) {
  case "generate":
    cmdGenerate();
    break;
  case "check":
    cmdCheck();
    break;
  default:
    stderr.write(`Unknown subcommand: ${subcommand}\nUsage: node scripts/generate-status.mjs [generate|check]\n`);
    exit(2);
}
