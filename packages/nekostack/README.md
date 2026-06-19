# nekostack

> The NekoStack full-stack development suite.

`npm install nekostack` installs the complete, version-locked NekoStack primitive layer:

| Package | What it is |
|---|---|
| `@nekostack/schema` | Canonical IR + multi-output schema system |
| `@nekostack/migrate-runner` | Schema-data migration state machine |
| `@nekostack/cli` | `neko` command — schema validation, codegen, migration management |
| `@nekostack/theme` | W3C DTCG design token pipeline — 3 themes × 2 modes, WCAG AA |
| `@nekostack/ui` | Vanilla CSS component library — 92 components, token-pure |

## Why a metapackage?

NekoStack is a modular monorepo. Navigating which packages to install and keeping their versions in sync is unnecessary friction for consumers. `nekostack` provides the guaranteed "golden path" combination — data definitions, migrations, CLI, tokens, and components that have been tested together and speak the same IR dialect.

## Install

```bash
npm install nekostack
```

To use Zod-generated validators at runtime, add `zod` to your own dependencies:

```bash
npm install zod
```

## À la carte

Install only what you need:

```bash
npm install @nekostack/schema                      # just the schema layer
npm install @nekostack/cli                         # just the CLI
npm install @nekostack/theme @nekostack/ui         # just the design layer
npm install @nekostack/schema @nekostack/migrate-runner  # schema + migrations
```
