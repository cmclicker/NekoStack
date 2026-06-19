# @nekostack/media

> Image processing: resize, format conversion (WebP / AVIF), responsive variants, optimization. The "make these images small + sharp" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative â€” adjacent (UI-facing) |
| **Depends on** | `schema`, `storage`, `audit`; external: `sharp` |
| **Used by** | NekoVibe (share-card backgrounds, avatars), NekoBattler (champion art at multiple resolutions), Mara Kane (book covers, illustrations), any product with user-uploaded images |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

Every product handling images reimplements: resize, format conversion, responsive variants (1x / 2x / 3x), thumbnail generation, EXIF stripping. `media` is the sharp-wrapping toolkit.

Distinct from `assets` (game asset pipeline â€” sprites, atlases) â€” `media` is UI-facing images: avatars, blog post heroes, product photos.

## Scope

### In scope
- Resize / crop / fit (cover / contain).
- Format conversion (PNG / JPEG â†’ WebP / AVIF).
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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ resize/
â”‚   â”‚   â”œâ”€â”€ cover.ts
â”‚   â”‚   â””â”€â”€ contain.ts
â”‚   â”œâ”€â”€ format/
â”‚   â”‚   â”œâ”€â”€ webp.ts
â”‚   â”‚   â””â”€â”€ avif.ts
â”‚   â”œâ”€â”€ responsive/
â”‚   â”‚   â””â”€â”€ variants.ts
â”‚   â”œâ”€â”€ thumbnail/
â”‚   â”‚   â””â”€â”€ generate.ts
â”‚   â”œâ”€â”€ exif/
â”‚   â”‚   â””â”€â”€ strip.ts
â”‚   â”œâ”€â”€ colorspace/
â”‚   â”‚   â””â”€â”€ convert.ts
â”‚   â”œâ”€â”€ optimize/
â”‚   â”‚   â””â”€â”€ quality.ts
â”‚   â””â”€â”€ watermark/
â”‚       â””â”€â”€ apply.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Resize + format conversion
### v0.2 â€” Responsive variants
### v0.3 â€” Thumbnail generation
### v0.4 â€” EXIF stripping
### v0.5 â€” Quality optimization
### v0.6 â€” Watermarking
### v1.0 â€” Stable API

## Product potential

**Internal:** Every product with images.
**Open source release:** Marginal â€” sharp wrapping.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative â€” adjacent.
- **Estimated learning return:** Moderate. Image processing, format selection, responsive design.
