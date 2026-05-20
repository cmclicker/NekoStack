/**
 * Step 24 — `schema migrate *` commander wiring dispatch tests.
 *
 * The four v0.8 migrate verbs have their own command-module test
 * files (`schema-migrate-list.test.ts`, `schema-migrate-plan.test.ts`,
 * `schema-migrate-verify.test.ts`, `schema-migrate-stub.test.ts`).
 * This file specifically asserts the **commander wiring**:
 *
 *   - argv reaches each verb's action without USAGE_ERROR
 *   - `--root` and `--json` are accepted on every verb
 *   - `plan` and `stub` require three positionals
 *   - extra positionals are rejected (`.allowExcessArguments(false)`)
 *   - unknown migrate verbs return USAGE_ERROR
 *   - no `apply` verb exists
 *   - no `--force` flag exists
 *
 * Dispatch reaches the command module through commander; we use
 * empty-but-real workspaces (mkdtempSync) so the underlying command
 * module's logic doesn't accidentally USAGE_ERROR on its own.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT_CODES } from "../../src/cli.js";
import { runCli } from "../cli-harness.js";

const tempRoots: string[] = [];

function makeEmptyRoot(): string {
  const r = mkdtempSync(join(tmpdir(), "neko-mig-dispatch-"));
  tempRoots.push(r);
  return r;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const r = tempRoots.pop()!;
    rmSync(r, { recursive: true, force: true });
  }
});

// =============================================================================
// `--root` / `--json` accepted on every verb
// =============================================================================

describe("commander wiring — `--root` and `--json` accepted on every migrate verb", () => {
  it("`schema migrate list --root <tmp> --json` parses (not USAGE_ERROR)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli(["schema", "migrate", "list", "--root", root, "--json"]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate plan <a> <b> <c> --root <tmp> --json` parses", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "plan",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "--root",
      root,
      "--json",
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate verify --root <tmp> --json` parses", async () => {
    const root = makeEmptyRoot();
    const r = await runCli(["schema", "migrate", "verify", "--root", root, "--json"]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate stub <a> <b> <c> --root <tmp> --json` parses", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "--root",
      root,
      "--json",
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// `plan` and `stub` require three positionals
// =============================================================================

describe("commander wiring — `plan` and `stub` require three positionals", () => {
  it("`schema migrate plan` with zero operands → USAGE_ERROR", async () => {
    const r = await runCli(["schema", "migrate", "plan"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate plan a` (one operand) → USAGE_ERROR", async () => {
    const r = await runCli(["schema", "migrate", "plan", "com.x.X"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate plan a b` (two operands) → USAGE_ERROR", async () => {
    const r = await runCli(["schema", "migrate", "plan", "com.x.X", "1.0.0"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate stub` with zero operands → USAGE_ERROR", async () => {
    const r = await runCli(["schema", "migrate", "stub"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate stub a b` (two operands) → USAGE_ERROR", async () => {
    const r = await runCli(["schema", "migrate", "stub", "com.x.X", "1.0.0"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// Extra positionals rejected (`.allowExcessArguments(false)`)
// =============================================================================

describe("commander wiring — extra positionals rejected", () => {
  it("`schema migrate list extra` → USAGE_ERROR", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "extra",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate plan a b c d` → USAGE_ERROR (fourth operand)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "plan",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "extra",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate verify extra` → USAGE_ERROR", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "verify",
      "extra",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate stub a b c d` → USAGE_ERROR (fourth operand)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "extra",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// Unknown verbs / hard-locked omissions
// =============================================================================

describe("commander wiring — unknown migrate verb + locked omissions", () => {
  it("`schema migrate wat` → USAGE_ERROR", async () => {
    const r = await runCli(["schema", "migrate", "wat"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate apply` → USAGE_ERROR (v0.8 hard-locked: no apply verb)", async () => {
    const r = await runCli(["schema", "migrate", "apply"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate stub --force` → USAGE_ERROR (no --force flag)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "--force",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate list --force` → USAGE_ERROR (no --force flag)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--force",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// Dispatch reaches command modules (smoke through commander)
// =============================================================================

describe("commander wiring — dispatch reaches each command module", () => {
  it("`schema migrate list` on empty workspace succeeds (commander → runMigrateList)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli(["schema", "migrate", "list", "--root", root]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("No migrations found");
  });

  it("`schema migrate verify` on empty workspace succeeds (commander → runMigrateVerify)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli(["schema", "migrate", "verify", "--root", root]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("No migrations to verify");
  });

  it("`schema migrate plan` on empty workspace returns LOGICAL_FAILURE with migration_missing_endpoint (commander → runMigratePlan)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "plan",
      "com.fixture.dispatch.X",
      "1.0.0",
      "2.0.0",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_missing_endpoint");
  });

  it("`schema migrate stub` on empty workspace returns LOGICAL_FAILURE with migration_missing_endpoint (commander → runMigrateStub)", async () => {
    const root = makeEmptyRoot();
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.fixture.dispatch.X",
      "1.0.0",
      "2.0.0",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_missing_endpoint");
  });
});

// =============================================================================
// Existing schema verbs unaffected
// =============================================================================

describe("commander wiring — v0.7 schema verbs still work after Step 24", () => {
  it("`schema list --root <tmp>` still succeeds on empty workspace", async () => {
    const root = makeEmptyRoot();
    const r = await runCli(["schema", "list", "--root", root]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("No schemas found");
  });
});

// =============================================================================
// Final cross-cutting static scan — `.transform(` is forbidden EVERYWHERE
// the migrate surface lives.
//
// Each command module has its own `.transform(` static-scan test in its
// own test file. This block is the all-modules-at-once regression net
// that catches a hypothetical future file (e.g., a shared migrate
// helper) which would slip past per-file scans.
// =============================================================================

describe("v0.8 migrate surface — `.transform(` forbidden across every source", () => {
  const MIGRATE_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "src",
    "commands",
    "schema",
    "migrate",
  );
  const CLI_TS = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "src",
    "cli.ts",
  );

  function listFiles(p: string): string[] {
    if (statSync(p).isDirectory()) {
      return readdirSync(p).flatMap((f) => listFiles(join(p, f)));
    }
    return [p];
  }

  const FILES = [...listFiles(MIGRATE_DIR), CLI_TS].filter((f) =>
    f.endsWith(".ts"),
  );

  it("scan covers every migrate command module + cli.ts (sentinel)", () => {
    const names = FILES.map((f) => f.split(/[\\/]/).pop()).sort();
    expect(names).toEqual([
      "cli.ts",
      "list.ts",
      "plan.ts",
      "stub.ts",
      "verify.ts",
    ]);
  });

  for (const file of FILES) {
    const name = file.split(/[\\/]/).pop();
    const SRC = readFileSync(file, "utf8");
    const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
      /\/\/.*$/gm,
      "",
    );
    it(`\`${name}\` source contains no \`.transform(\` call`, () => {
      expect(STRIPPED).not.toMatch(/\.transform\s*\(/);
    });
  }
});
