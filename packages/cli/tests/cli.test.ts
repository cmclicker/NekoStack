/**
 * Step 25 — `cli.ts` gate tests.
 *
 * Drives `dispatch(argv)` in-process per CLI plan Decision #9. Each
 * test passes its own stdout/stderr writers so commander's output is
 * fully observable and isolated from the test reporter.
 *
 * Covers:
 *   - root help works and lists the `schema` command group
 *   - `--version` prints the @nekostack/cli package version
 *   - `schema --help` lists the four locked verbs
 *   - the four placeholder verbs return LOGICAL_FAILURE with a
 *     "not yet implemented" stderr message — wiring proof that the
 *     dispatch substrate works even though Steps 29–32 haven't
 *     replaced each `.action()` yet
 *   - unknown command and bad flag both map to USAGE_ERROR
 *   - dispatch source carries no `process.exit` calls (the bin entry
 *     `run()` is allowed to call it, but the reusable dispatch path
 *     must not)
 *   - the four verbs are wired in declaration order
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import {
  dispatch,
  EXIT_CODES,
  buildCli,
  type ExitCode,
} from "../src/cli.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

// =============================================================================
// Helpers — capture stdout/stderr during a dispatch call
// =============================================================================

interface Captured {
  readonly code: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

async function run(argv: readonly string[]): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await dispatch(argv, {
    stdout: (s) => {
      stdout += s;
    },
    stderr: (s) => {
      stderr += s;
    },
  });
  return { code, stdout, stderr };
}

// =============================================================================
// Help + version
// =============================================================================

describe("dispatch — root help and version", () => {
  it("`neko --help` returns SUCCESS and mentions the schema command", async () => {
    const r = await run(["--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/schema/);
    expect(r.stdout.toLowerCase()).toMatch(/usage|commands/);
  });

  it("`neko -h` is equivalent to `--help`", async () => {
    const r = await run(["-h"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/schema/);
  });

  it("`neko --version` prints the @nekostack/cli package version", async () => {
    const r = await run(["--version"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout.trim()).toBe(pkg.version);
  });

  it("`neko -v` is equivalent to `--version`", async () => {
    const r = await run(["-v"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout.trim()).toBe(pkg.version);
  });

  it("a caller-supplied `version` overrides the default", async () => {
    let stdout = "";
    const code = await dispatch(["--version"], {
      version: "9.9.9-test",
      stdout: (s) => {
        stdout += s;
      },
      stderr: () => {},
    });
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(stdout.trim()).toBe("9.9.9-test");
  });
});

describe("dispatch — schema group help", () => {
  it("`neko schema --help` lists all four verbs in order", async () => {
    const r = await run(["schema", "--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/\blist\b/);
    expect(r.stdout).toMatch(/\bdiff\b/);
    expect(r.stdout).toMatch(/\bcheck\b/);
    expect(r.stdout).toMatch(/\bgenerate\b/);

    // Order matters — declaration order is the contract.
    const listIdx = r.stdout.indexOf("list");
    const diffIdx = r.stdout.indexOf("diff");
    const checkIdx = r.stdout.indexOf("check");
    const genIdx = r.stdout.indexOf("generate");
    expect(listIdx).toBeLessThan(diffIdx);
    expect(diffIdx).toBeLessThan(checkIdx);
    expect(checkIdx).toBeLessThan(genIdx);
  });
});

// =============================================================================
// Placeholder verbs
// =============================================================================

describe("dispatch — placeholder verb actions", () => {
  it.each(["list", "diff", "check", "generate"] as const)(
    "`neko schema %s` returns LOGICAL_FAILURE with a TODO message",
    async (verb) => {
      // `diff` takes two positional args; pass them so commander
      // doesn't reject for missing required arguments before the
      // placeholder action runs.
      const argv =
        verb === "diff"
          ? ["schema", "diff", "com.x.A", "com.x.B"]
          : ["schema", verb];
      const r = await run(argv);
      expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
      expect(r.stderr).toMatch(/not yet implemented/);
      expect(r.stderr).toMatch(new RegExp(`schema ${verb}\\b`));
    },
  );
});

// =============================================================================
// Usage errors
// =============================================================================

describe("dispatch — usage errors", () => {
  it("an unknown subcommand returns USAGE_ERROR", async () => {
    const r = await run(["frobnicate"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("an unknown schema verb returns USAGE_ERROR", async () => {
    const r = await run(["schema", "wat"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("an unknown flag returns USAGE_ERROR", async () => {
    const r = await run(["--bogus-flag"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema diff` without both arguments returns USAGE_ERROR", async () => {
    const r = await run(["schema", "diff"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// Builder shape
// =============================================================================

describe("buildCli — shape", () => {
  it("registers the expected commands in declaration order", () => {
    const program = buildCli();
    const top = program.commands.map((c) => c.name());
    expect(top).toEqual(["schema"]);

    const schema = program.commands.find((c) => c.name() === "schema");
    const verbs = schema?.commands.map((c) => c.name());
    expect(verbs).toEqual(["list", "diff", "check", "generate"]);
  });

  it("EXIT_CODES is the locked enum", () => {
    expect(EXIT_CODES).toEqual({
      SUCCESS: 0,
      LOGICAL_FAILURE: 1,
      USAGE_ERROR: 2,
      IO_ERROR: 3,
      INTEGRITY_ERROR: 4,
    });
  });
});

// =============================================================================
// Bin wiring — pack manifest matches what `bin/neko` reaches for
// =============================================================================

describe("bin/neko — wiring sanity", () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const BIN = readFileSync(join(ROOT, "bin", "neko"), "utf8");
  const PKG = require(join(ROOT, "package.json")) as {
    bin: Record<string, string>;
  };

  it("bin/neko imports the dist build output that `tsc -p tsconfig.build.json` produces", () => {
    // The launcher must reach for `../dist/cli.js`, which is the
    // top-level emit of `tsconfig.build.json`. If the build config
    // ever changes to nest under `dist/src/`, this assertion catches
    // the drift before the bin link silently breaks.
    expect(BIN).toMatch(/["']\.\.\/dist\/cli\.js["']/);
  });

  it("package.json bin entry points at the launcher script", () => {
    expect(PKG.bin?.neko).toBe("./bin/neko");
  });
});

// =============================================================================
// Dispatch must NOT call process.exit (static-scan, same as Step 22/23/24)
// =============================================================================

describe("cli.ts — dispatch does not call process.exit", () => {
  const SRC = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.ts"),
    "utf8",
  );

  const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /\/\/.*$/gm,
    "",
  );

  it("the only `process.exit` call is inside `run()`", () => {
    // Count occurrences. The locked design is: exactly one call,
    // inside the `run()` production entry. Anywhere else is a
    // regression — dispatch must return its exit code.
    const matches = STRIPPED.match(/process\s*\.\s*exit\s*\(/g) ?? [];
    expect(matches.length).toBe(1);

    // The call must appear inside the `run` function body — i.e.
    // after the `export async function run` declaration.
    const runDeclIdx = STRIPPED.search(/export\s+async\s+function\s+run\b/);
    const exitIdx = STRIPPED.search(/process\s*\.\s*exit\s*\(/);
    expect(runDeclIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(runDeclIdx);
  });
});
