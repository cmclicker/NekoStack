# @nekostack/storage

> File upload + object storage abstraction. S3-compatible, local fallback, signed URLs, content-addressable storage. The "where do uploads go?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (object metadata), `audit`, `secrets` (S3 credentials), `crypto` (at-rest encryption); external: AWS SDK / S3-compatible client |
| **Used by** | `media` (image processing pipeline), `export` (archive output), `backup` (snapshot storage), any product handling user uploads (NekoVibe avatars / share cards, NekoBattler asset hosting, Leytide player content, Mara Kane narrative drafts) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Modest — abstraction layers over S3 exist; library-level integration |

## Why this exists

Every product handling user uploads reinvents the same patterns:
- S3 in prod, local filesystem in dev.
- Signed URLs for direct browser uploads.
- Content-addressable storage (hash-based filenames).
- At-rest encryption for sensitive files.
- Cleanup of orphaned uploads.

`storage` abstracts these once. Same API across adapters.

## Scope

### In scope
- Adapter contract (put / get / delete / signed-url / list).
- Adapters: S3, S3-compatible (R2 / B2 / MinIO), local filesystem (dev), in-memory (tests).
- Signed URLs for direct upload + download.
- Content-addressable storage (hash-based keys).
- At-rest encryption (via `crypto`).
- Metadata storage alongside binaries.
- Orphan detection + cleanup.
- Multi-part upload for large files.

### Out of scope
- Image / video processing (`media`).
- CDN configuration.
- Game asset pipeline (`assets`).
- Backup operations (`backup` uses us).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §24 for the full capability map.

### Owns
- Object storage adapter contract
- S3 / R2 / B2 / MinIO / local / memory adapters
- Signed URLs
- Content-addressable keys
- At-rest encryption
- Metadata
- Orphan cleanup
- Multi-part upload

### Does NOT own
| Capability | Lives in |
|---|---|
| Image processing | `media` |
| Game asset pipeline | `assets` |
| Backup snapshots | `backup` (uses us) |
| Export archive packaging | `export` (uses us) |
| CDN config | vendor-specific |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **AWS S3 SDK direct** | Substrate. | No abstraction layer. |
| **Cloudflare R2 + Workers** | Cheap S3-alternative. | S3-API compatible; we wrap. |
| **uploadthing** | DX-friendly upload library. | Hosted-coupled. |
| **Custom S3 wrapper** | Common. | Reinvented per product. |

## How this fits the NekoStack

- **`media`** processes images stored in us.
- **`export`** writes archives to us.
- **`backup`** stores snapshots.
- **`secrets`** provides S3 credentials.
- **`crypto`** for encryption.

## Design philosophy

- **Local fallback in dev.** No requirement to spin up S3 just to develop.
- **Same API across adapters.** S3 ↔ R2 ↔ local is a config change.
- **Signed URLs are default.** Direct browser uploads avoid server-side bandwidth.
- **Content-addressable when sensible.** Deduplication + cache-busting for free.

## Architecture sketch

```
packages/storage/
├── src/
│   ├── interface/
│   │   ├── adapter.ts
│   │   └── object.ts
│   ├── adapters/
│   │   ├── s3.ts
│   │   ├── r2.ts
│   │   ├── b2.ts
│   │   ├── minio.ts
│   │   ├── local.ts
│   │   └── memory.ts
│   ├── signed/
│   │   ├── upload.ts
│   │   └── download.ts
│   ├── content-addressed/
│   │   └── hash-key.ts
│   ├── encrypt/
│   │   └── at-rest.ts
│   ├── metadata/
│   │   └── store.ts
│   ├── cleanup/
│   │   └── orphans.ts
│   ├── multipart/
│   │   └── upload.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Adapter contract + local + memory
### v0.2 — S3 adapter
### v0.3 — Signed URLs
### v0.4 — Content-addressable keys
### v0.5 — R2 / B2 / MinIO adapters
### v0.6 — At-rest encryption
### v0.7 — Orphan cleanup
### v0.8 — Multi-part upload
### v1.0 — Stable API

## Product potential

**Internal:** Required for any product with uploads.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** Moderate. S3 API patterns, signed URLs, content-addressable storage, multipart uploads.
