# @nekostack/media

> Image processing: resize, format conversion (WebP / AVIF), responsive variants, optimization. The "make these images small + sharp" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative — adjacent (UI-facing) |
| **Depends on** | `schema`, `storage`, `audit`; external: `sharp` |
| **Used by** | NekoVibe (share-card backgrounds, avatars), NekoBattler (champion art at multiple resolutions), Mara Kane (book covers, illustrations), any product with user-uploaded images |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Low — Cloudinary / Imgix dominate hosted; sharp-wrapper niche |

## Why this exists

Every product handling images reimplements: resize, format conversion, responsive variants (1x / 2x / 3x), thumbnail generation, EXIF stripping. `media` is the sharp-wrapping toolkit.

Distinct from `assets` (game asset pipeline — sprites, atlases) — `media` is UI-facing images: avatars, blog post heroes, product photos.

## Scope

### In scope
- Resize / crop / fit (cover / contain).
- Format conversion (PNG / JPEG → WebP / AVIF).
- Responsive variants (1x / 2x / 3x).
- Thumbnail generation.
- EXIF stripping.
- Color-space conversion.
- Quality optimization.
- Watermarking.

### Out of scope
- Game asset pipeline (`assets`).
- Storage (`storage`).
- Video processing.
- 3D / model processing.

## Boundary

### Owns
- Image resize / crop / fit
- Format conversion
- Responsive variants
- Thumbnail generation
- EXIF stripping
- Color-space conversion
- Quality optimization
- Watermarking

### Does NOT own
| Capability | Lives in |
|---|---|
| Game asset pipeline (sprites / atlases) | `assets` |
| Storage backend | `storage` |
| Video / audio | out of scope / `audio` |
| CDN config | external |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **sharp** | Best Node image library. | Substrate. |
| **Cloudinary** | Hosted image transformation. | Vendor; expensive. |
| **Imgix** | Same shape. | Vendor. |
| **next/image** | Framework-coupled. | Framework only. |

## How this fits the NekoStack

- **`storage`** stores processed images.
- **`audit`** records transformations.
- Used by anything that takes user-uploaded images.

## Design philosophy

- **sharp under the hood.** Don't reinvent.
- **Responsive by default.** Generate 1x / 2x / 3x.
- **EXIF stripped by default.** Privacy + size.
- **Modern formats.** WebP / AVIF first, JPEG fallback.

## Architecture sketch

```
packages/media/
├── src/
│   ├── resize/
│   │   ├── cover.ts
│   │   └── contain.ts
│   ├── format/
│   │   ├── webp.ts
│   │   └── avif.ts
│   ├── responsive/
│   │   └── variants.ts
│   ├── thumbnail/
│   │   └── generate.ts
│   ├── exif/
│   │   └── strip.ts
│   ├── colorspace/
│   │   └── convert.ts
│   ├── optimize/
│   │   └── quality.ts
│   └── watermark/
│       └── apply.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Resize + format conversion
### v0.2 — Responsive variants
### v0.3 — Thumbnail generation
### v0.4 — EXIF stripping
### v0.5 — Quality optimization
### v0.6 — Watermarking
### v1.0 — Stable API

## Product potential

**Internal:** Every product with images.
**Open source release:** Marginal — sharp wrapping.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative — adjacent.
- **Estimated learning return:** Moderate. Image processing, format selection, responsive design.
