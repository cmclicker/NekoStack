# nekostack

> The NekoStack Metapackage

This is the public distribution package for NekoStack. Installing `nekostack` automatically resolves and downloads the exact, compatible versions of the core NekoStack primitives:

- **`@nekostack/schema`**: The canonical data-contract IR, validation, and generation engine.
- **`@nekostack/migrate-runner`**: The schema-data migration state machine.

(Note: As we stabilize other layers of the stack such as `@nekostack/cli` and `@nekostack/ui`, they will be added to this manifest).

## Why a Metapackage?

NekoStack is built as a highly modular monorepo. However, for consumers, navigating which packages to install and ensuring version compatibility across the stack is an unnecessary friction point. 

By installing `nekostack`, you get the guaranteed "golden path" combination of packages, ensuring that your data definitions, migrations, and CLI tooling all speak the exact same IR dialect without the fear of empty folders or mismatched APIs.

## Installation

```bash
npm install nekostack
```
