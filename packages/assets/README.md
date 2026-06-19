# @nekostack/assets

> Game asset pipeline: sprite atlases, audio sprite sheets, animation sequences, content validation, hot-reload in dev, hashed/optimized output in prod. Every NekoStack game project's asset story in one place.

## Quick reference

| | |
|---|---|
| **Build tier** | Project unblocker â€” NekoBattler's 565-champion roster and Leytide's world content cannot scale without it |
| **Depends on** | `schema` (manifest format), `codex` (entity reference validation), `cli`; external substrates: `sharp`, `ffmpeg`, atlas packers, Aseprite CLI |
| **Used by** | NekoBattler, NekoGacha, Leytide, NekoVibe (game icons + share-card art), future game projects |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“20 weeks focused |

## Why this exists

Games have content that isn't code: sprites, sound effects, music, animations, particle textures, fonts, JSON content files, level data. Without a deliberate pipeline, every game project ends up with:

- Hundreds of individual image files that produce hundreds of HTTP requests on load.
- No atlasing, so GPU sprite-batching can't happen efficiently.
- Audio that plays through `<audio>` elements with race conditions and no overlap handling.
- Asset paths hardcoded in code, so renames break things silently.
- No content validation â€” a JSON champion definition referencing a missing ability fails at runtime.
- No hot-reload, so iteration on art is "rebuild, refresh, lose state."

NekoBattler has 565 champions in `BESPOKE_GAP_LIST.md`. Each one needs at minimum a sprite, plus ability icons, plus animations. That's thousands of assets. Without a pipeline, the dev loop becomes the limiting factor on creative iteration.

`@nekostack/assets` is the pipeline: declarative asset manifests, atlas packing, audio sprite generation, content validation against `@nekostack/codex` entity definitions, hashed output for cache-busting, hot-reload for development. Plug it in once per project; iterate on art at the speed of art.

Building this yourself rather than using Phaser's asset pipeline, PixiJS-Asset, or webpack-asset loaders is justified because:
1. **Engine-independent.** Phaser's pipeline assumes Phaser. We work for plain canvas, PixiJS, Three.js, Cocos, or your own custom renderer.
2. **Codex integration.** Asset references can be validated against `@nekostack/codex` entity definitions â€” a champion entity in Codex references an asset id; the pipeline validates that id resolves.
3. **Hot-reload across engines.** Generic build tools (Vite) hot-reload code; we hot-reload textures and audio across whatever rendering engine is in use.
4. **Atlas packing as a first-class concern.** Not a webpack plugin afterthought.

## Scope

### In scope
- Asset manifest format (declarative description of inputs and processing rules).
- Texture atlas packing (TexturePacker-style, multiple bin-packing algorithms).
- Audio sprite generation (concatenated audio file + JSON timing map).
- Sprite sequence handling (animation frame extraction, naming conventions).
- Format conversion (PNG â†’ AVIF/WebP, WAV â†’ OGG/Opus).
- Content validation against `@nekostack/codex` entity schemas.
- Build-time output with content-hashing for cache-busting.
- Dev-time hot-reload server.
- Runtime asset loader with progressive loading + retries.
- CLI integration (`neko assets build`, `neko assets dev`).

### Out of scope
- Creating assets (we don't replace Aseprite, Photoshop, Audacity).
- 3D model pipelines (glTF, FBX). Out of v1 scope; could be a sibling package.
- Streaming video. Different domain.
- Asset DRM / watermarking. Out of scope.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§43 for the full capability map.

### Owns
- Asset manifest format (declarative inputs + processing rules)
- Sprite atlas packing (multiple bin-packing algorithms)
- Audio sprite generation (concatenated file + JSON timing map)
- Sprite sequence / animation frame extraction
- Format conversion (PNG â†’ AVIF/WebP, WAV â†’ OGG/Opus)
- Content validation against `codex` entity schemas
- Build-time content hashing for cache-busting
- Dev-time hot-reload server
- Runtime asset loader (progressive load + retries)
- Engine adapters (Canvas, PixiJS, Three.js, custom)

### Does NOT own
| Capability | Lives in |
|---|---|
| Authoring assets (Aseprite, Photoshop, Audacity) | external (we ingest, never create) |
| Image processing primitives | external (`sharp` â€” we orchestrate) |
| Audio transcoding primitives | external (`ffmpeg` â€” we orchestrate) |
| Atlas packing algorithms themselves | external (TexturePacker or free alternatives) |
| Image processing for non-game web (resize / responsive / WebP) | `media` (UI-facing media, distinct from game assets) |
| 3D model pipelines (glTF, FBX) | out of scope (v1) |
| Streaming video | out of scope |
| Save data | `saves` |
| Audio playback engine | `audio` (we build sprites; audio plays them) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **TexturePacker** | Best-in-class atlas packing. Mature, paid GUI. | One step in our pipeline. We need orchestration around it. |
| **AssetGraph** | Web-asset processing. | Web-focused, not game-asset shaped. |
| **Phaser asset loader** | Game-integrated. | Phaser-coupled. |
| **PixiJS Assets** | Modern PixiJS asset system. | Pixi-coupled. |
| **Webpack/Vite asset plugins** | Bundler-integrated. | Bundler-coupled, not game-aware (no atlasing, no audio sprites). |
| **Bun's bundler** | Fast. | Same shape as Vite for our purposes. |
| **Aseprite CLI** | Exports sprite sheets from .ase files. | One step in our pipeline (we'd integrate it). |
| **ffmpeg** | Audio/video transcoding. | One step in our pipeline. |
| **sharp** | Best-in-class image processing in Node. | One step in our pipeline. |

The right framing: this is the **orchestration layer over established tools** (sharp, ffmpeg, free atlas-packers, Aseprite CLI), producing a declarative pipeline that runs the same way across every NekoStack game project.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` â€” asset manifest schema, asset descriptor validation.
- `@nekostack/codex` â€” entity references resolve against Codex.
- `@nekostack/cli` â€” `neko assets` subcommands.
- `sharp`, `ffmpeg`, atlas packers â€” external substrates.

**Used by:**
- **NekoBattler** â€” 565+ champion sprites + ability icons + animations.
- **NekoGacha** â€” character art, banner art, UI flourishes.
- **Leytide** â€” world tilesets, character sprites, environment textures, audio.
- **NekoVibe** â€” game icons, UI sprites, share-card art.
- Future game projects.

## Design philosophy

- **Declarative manifest, imperative execution.** You describe what you want; the tool figures out how.
- **Hot-reload first.** Dev loop optimization is paramount. Iterating on a sprite shouldn't require a full rebuild.
- **Content-hash everything in prod.** Asset URLs include hashes so cache-busting works automatically.
- **Validate references.** A champion entity in Codex references `sprite: 'champ:ember-cat'`. The pipeline verifies the sprite exists at build time.
- **Engine-agnostic output.** The pipeline produces a manifest + bundled assets; consuming engines (Canvas, PixiJS, Three.js, custom) load via a small runtime SDK.

## Architecture sketch

```
packages/assets/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ manifest/
â”‚   â”‚   â”œâ”€â”€ schema.ts         # asset manifest format
â”‚   â”‚   â””â”€â”€ parse.ts
â”‚   â”œâ”€â”€ pipeline/
â”‚   â”‚   â”œâ”€â”€ sprite.ts         # PNG/WebP/AVIF processing
â”‚   â”‚   â”œâ”€â”€ atlas.ts          # bin-packing
â”‚   â”‚   â”œâ”€â”€ audio.ts          # audio sprite generation
â”‚   â”‚   â”œâ”€â”€ sequence.ts       # animation frame extraction
â”‚   â”‚   â””â”€â”€ hash.ts           # content hashing
â”‚   â”œâ”€â”€ validation/
â”‚   â”‚   â”œâ”€â”€ refs.ts           # validate against Codex
â”‚   â”‚   â””â”€â”€ content.ts        # validate JSON content files
â”‚   â”œâ”€â”€ dev-server/
â”‚   â”‚   â”œâ”€â”€ hot-reload.ts     # ws-based asset reload
â”‚   â”‚   â””â”€â”€ watcher.ts        # file watcher
â”‚   â”œâ”€â”€ runtime/
â”‚   â”‚   â”œâ”€â”€ loader.ts         # progressive load + retry
â”‚   â”‚   â””â”€â”€ manifest-client.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

Manifest example:

```yaml
# assets.manifest.yaml
sprites:
  champions:
    src: art/champions/**/*.aseprite
    atlas: out/champion-atlas
    format: webp
    sizes: [1x, 2x]
  ui:
    src: art/ui/**/*.png
    atlas: out/ui-atlas
audio:
  sfx:
    src: audio/sfx/*.wav
    sprite: out/sfx
    format: opus
  music:
    src: audio/music/*.flac
    format: opus
    individual: true
content:
  champions:
    src: data/champions/*.json
    validate: codex:Character
```

Build:

```
$ neko assets build
âœ” 565 sprites â†’ 4 atlases (88% packing efficiency)
âœ” 1,124 audio clips â†’ 6 sprites
âœ” 565 champion JSON files validated against Codex:Character
âœ” All assets hashed and output to dist/assets/
```

## Roadmap

### v0.1 â€” Sprite pipeline
- Manifest format.
- PNG â†’ WebP/AVIF conversion.
- Simple atlas packing.

### v0.2 â€” Audio pipeline
- WAV â†’ OGG/Opus conversion.
- Audio sprite generation.

### v0.3 â€” Aseprite integration
- Aseprite CLI export wrapper.
- Animation frame extraction.

### v0.4 â€” Validation
- Content JSON validation via `@nekostack/schema`.
- Codex reference validation.

### v0.5 â€” Hashing + production output
- Content-hashed filenames.
- Manifest JSON for runtime loading.

### v0.6 â€” Dev server
- File watcher.
- Hot-reload over WebSocket.

### v0.7 â€” Runtime SDK
- Loader with progressive load + retry.
- Per-engine adapters (Canvas, PixiJS, Three.js).

### v1.0 â€” Stable API
- Documentation site.
- Performance benchmarks (build time at 1K / 10K assets).

## Product potential

**Internal use:** Essential for every game project.

**Open source release:** Plausible. Engine-agnostic asset pipelines are surprisingly rare â€” most are coupled to one engine. MIT release could attract indie game devs.


**Estimated effort to v1.0:** 12-20 weeks of focused work. Most steps wrap existing tools; the orchestration and the dev-server hot-reload are where time goes.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Project unblocker. Critical for NekoBattler's 565-champion scope and Leytide's world content.
- **Estimated learning return:** High. Build-pipeline architecture, image/audio processing, bin-packing algorithms, content-addressable storage â€” all transferable to web ops generally.
