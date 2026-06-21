# `nekostack` (metapackage) — Roadmap

Authoritative source for "what ships when" on the umbrella metapackage. The
metapackage has no source of its own — it is a dependency manifest that pins the
published suite. Its releases track the member packages, so this roadmap moves
only when the suite's surface changes.

## v1.1 — Full published suite

Status: **shipped**. Apache-2.0. Published to npm as `nekostack`.

One install brings in the full published NekoStack suite: `@nekostack/schema`,
`@nekostack/migrate-runner`, `@nekostack/cli`, `@nekostack/theme`, and
`@nekostack/ui`. Peer dep `zod ^3.22.0` (required by `@nekostack/schema`).

## Future

The metapackage bumps a minor when a new package joins the default suite, and a
patch when a member's published range is re-verified against new patch releases.
Member packages are added here as each reaches a stable public surface.
