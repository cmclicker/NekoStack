#!/usr/bin/env node
// Shebang launcher for `@nekostack/cli`. Loads the compiled CLI entry
// (`dist/cli.js`, built from `src/cli.ts`) and invokes its exported
// `run()` function with the current `process.argv`. `run()` calls
// `process.exit` with the dispatch result, so this file never returns.
import("../dist/cli.js").then((m) => m.run());
