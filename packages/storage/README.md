# @nekostack/storage

> File upload + object storage abstraction. S3-compatible, local fallback, signed URLs, content-addressable storage. The "where do uploads go?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (object metadata), `audit`, `secrets` (S3 credentials), `crypto` (at-rest encryption); external: AWS SDK / S3-compatible client |
| **Used by** | `media` (image processing pipeline), `export` (archive output), `backup` (snapshot storage), any product handling user uploads (NekoVibe avatars / share cards, NekoBattler asset hosting, Leytide player content, Mara Kane narrative drafts) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§24 for the full capability map.

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
- **Same API across adapters.** S3 â†” R2 â†” local is a config change.
- **Signed URLs are default.** Direct browser uploads avoid server-side bandwidth.
- **Content-addressable when sensible.** Deduplication + cache-busting for free.

## Architecture sketch

```
packages/storage/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ interface/
â”‚   â”‚   â”œâ”€â”€ adapter.ts
â”‚   â”‚   â””â”€â”€ object.ts
â”‚   â”œâ”€â”€ adapters/
â”‚   â”‚   â”œâ”€â”€ s3.ts
â”‚   â”‚   â”œâ”€â”€ r2.ts
â”‚   â”‚   â”œâ”€â”€ b2.ts
â”‚   â”‚   â”œâ”€â”€ minio.ts
â”‚   â”‚   â”œâ”€â”€ local.ts
â”‚   â”‚   â””â”€â”€ memory.ts
â”‚   â”œâ”€â”€ signed/
â”‚   â”‚   â”œâ”€â”€ upload.ts
â”‚   â”‚   â””â”€â”€ download.ts
â”‚   â”œâ”€â”€ content-addressed/
â”‚   â”‚   â””â”€â”€ hash-key.ts
â”‚   â”œâ”€â”€ encrypt/
â”‚   â”‚   â””â”€â”€ at-rest.ts
â”‚   â”œâ”€â”€ metadata/
â”‚   â”‚   â””â”€â”€ store.ts
â”‚   â”œâ”€â”€ cleanup/
â”‚   â”‚   â””â”€â”€ orphans.ts
â”‚   â”œâ”€â”€ multipart/
â”‚   â”‚   â””â”€â”€ upload.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Adapter contract + local + memory
### v0.2 â€” S3 adapter
### v0.3 â€” Signed URLs
### v0.4 â€” Content-addressable keys
### v0.5 â€” R2 / B2 / MinIO adapters
### v0.6 â€” At-rest encryption
### v0.7 â€” Orphan cleanup
### v0.8 â€” Multi-part upload
### v1.0 â€” Stable API

## Product potential

**Internal:** Required for any product with uploads.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** Moderate. S3 API patterns, signed URLs, content-addressable storage, multipart uploads.
