# {{project.name}}

> Built on [NekoStack](https://github.com/cmclicker/NekoStack)

> **⚠️ Reference scaffold — not yet runnable as a `create-` template.** It depends on `@nekostack/cli` (the `neko` command) and `@nekostack/theme`, which are **not yet published to npm**. Only `@nekostack/schema` (`v1.0.0`) is published today, and `nekostack.config.ts`'s `defineConfig` import is not available yet. Treat this as an architecture reference until the rest of the stack ships.

This project was scaffolded using the canonical `web:standard` blueprint. It comes pre-configured with the NekoStack architectural invariants.

## The Architecture

Your codebase is divided into three primary domain boundaries:

1.  **`schemas/`**: The Single Source of Truth for your data structures, APIs, and business objects.
2.  **`theme/`**: The Single Source of Truth for your design system tokens.
3.  **`ui/`**: Your presentation components, mathematically bound to the `theme/` registry.

## The "Proper Procedure" Workflow

When you need to change a data structure or add a design token, you **never** edit the Zod validators or the TypeScript interfaces directly.

1.  Edit the `.schema.ts` file in `schemas/` or `theme/`.
2.  Run the generator:
    ```bash
    npm run neko:generate
    ```
3.  The NekoStack engine will automatically update your Zod files, TypeScript definitions, JSON Schemas, and CSS Variables.
4.  Commit the changes.

## The Safety Net (CI)

Your repository includes a `.github/workflows/ci.yml` file. Every time you push or open a Pull Request, the CI server runs:

```bash
npm run neko:check
```

If a developer edited a schema file but forgot to run `neko:generate`, the CI will instantly fail with a `Stale Artifact` error, preventing a "Silent Lie" from reaching your production environment.
