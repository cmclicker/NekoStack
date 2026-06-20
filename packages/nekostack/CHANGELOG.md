# `nekostack` — Changelog

Per-milestone changes. Pairs with git tags (`nekostack-vX.Y.Z`) and [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

Published to npm as `nekostack` (Apache-2.0). Installing this metapackage gives you the full suite; use scoped packages à la carte if you prefer.

---

## nekostack-v1.1.1 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/nekostack-v1.1.1) · Patch bump to track cli and ui patch releases.

### Changed

- Tracks `@nekostack/cli@^1.0.0` and `@nekostack/ui@^1.0.0` — semver ranges already cover the v1.0.1 patches; this bump signals that the metapackage has been verified against the patched versions.

---

## nekostack-v1.1.0 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/nekostack-v1.1.0) · First public release of the metapackage.

### What it is

A convenience metapackage. One install brings in the full published NekoStack suite:

| Dependency | Version range |
|---|---|
| `@nekostack/schema` | `^1.0.0` |
| `@nekostack/migrate-runner` | `^1.0.0` |
| `@nekostack/cli` | `^1.0.0` |
| `@nekostack/theme` | `^1.0.0` |
| `@nekostack/ui` | `^1.0.0` |

Peer dep: `zod ^3.22.0` (required by `@nekostack/schema`).

### Install

```bash
npm install nekostack
# or à la carte:
npm install @nekostack/schema @nekostack/cli
```
