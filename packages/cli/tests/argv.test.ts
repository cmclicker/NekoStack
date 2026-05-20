/**
 * Step 34 — argv parsing + usage-error gate tests.
 *
 * Focuses on the **shape** of argv handling — not on what each verb
 * does once it runs. Per-verb semantics are covered in
 * `tests/commands/schema-*.test.ts`. This file's only job is to
 * prove that commander accepts the locked option set, rejects
 * anything outside it with `USAGE_ERROR`, and routes positionals
 * to the verbs that declare them.
 *
 * Every test runs through the shared `runCli` harness — no
 * subprocess spawn, no `process.exit`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXIT_CODES } from "../src/cli.js";
import { runCli } from "./cli-harness.js";

// =============================================================================
// Empty workspace shared across all positive argv-shape tests.
// =============================================================================
//
// Each verb needs a `--root` that points somewhere readable so the
// run doesn't accidentally pick up the developer's `process.cwd()`
// or fail with IO_ERROR. An empty tmp dir is the right neutral
// ground: list/check/generate return SUCCESS over an empty
// workspace; diff returns LOGICAL_FAILURE because the operands
// don't resolve, which still proves argv parsing accepted them.

let emptyRoot: string;

beforeAll(() => {
  emptyRoot = mkdtempSync(join(tmpdir(), "neko-argv-"));
});

afterAll(() => {
  rmSync(emptyRoot, { recursive: true, force: true });
});

// =============================================================================
// Unknown commands / verbs / flags → USAGE_ERROR
// =============================================================================

describe("argv — unknown commands and flags return USAGE_ERROR", () => {
  it("unknown root command", async () => {
    const r = await runCli(["frobnicate"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("unknown schema verb", async () => {
    const r = await runCli(["schema", "wat"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("unknown root flag", async () => {
    const r = await runCli(["--bogus"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it.each([
    ["list", ["schema", "list", "--bogus"]],
    ["diff", ["schema", "diff", "a", "b", "--bogus"]],
    ["check", ["schema", "check", "--bogus"]],
    ["generate", ["schema", "generate", "--bogus"]],
  ] as const)("unknown flag on `schema %s`", async (_verb, argv) => {
    const r = await runCli(argv);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// Missing required positionals → USAGE_ERROR
// =============================================================================

describe("argv — missing required `schema diff` operands", () => {
  it("no operands", async () => {
    const r = await runCli(["schema", "diff"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("only one operand", async () => {
    const r = await runCli(["schema", "diff", "com.x.Only"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// Accepted options — argv parses cleanly, no USAGE_ERROR
// =============================================================================

describe("argv — `--root <path>` is accepted by every verb", () => {
  it("`schema list --root <tmp>` parses (no USAGE_ERROR)", async () => {
    const r = await runCli(["schema", "list", "--root", emptyRoot]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema diff <a> <b> --root <tmp>` parses (no USAGE_ERROR)", async () => {
    // The operands won't resolve in an empty workspace, so the verb
    // returns LOGICAL_FAILURE — but argv parsed successfully.
    const r = await runCli([
      "schema",
      "diff",
      "com.x.A",
      "com.x.B",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema check --root <tmp>` parses (no USAGE_ERROR)", async () => {
    const r = await runCli(["schema", "check", "--root", emptyRoot]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema generate --root <tmp>` parses (no USAGE_ERROR)", async () => {
    const r = await runCli(["schema", "generate", "--root", emptyRoot]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });
});

describe("argv — `--json` is accepted by every schema verb", () => {
  it.each([
    ["list", ["schema", "list", "--json", "--root", () => emptyRoot]],
    [
      "diff",
      ["schema", "diff", "com.x.A", "com.x.B", "--json", "--root", () => emptyRoot],
    ],
    ["check", ["schema", "check", "--json", "--root", () => emptyRoot]],
    ["generate", ["schema", "generate", "--json", "--root", () => emptyRoot]],
  ] as const)("`schema %s --json` parses (no USAGE_ERROR)", async (_verb, argv) => {
    const resolved = argv.map((x) => (typeof x === "function" ? x() : x));
    const r = await runCli(resolved);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });
});

describe("argv — `--quiet` acceptance is verb-specific", () => {
  it("`schema list --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "list",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema check --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "check",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema generate --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "generate",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema diff --quiet` is REJECTED (unknown flag)", async () => {
    // `diff` doesn't declare `--quiet` — the locked CLI surface
    // omits it because diff output is the answer the user wants,
    // not an optional log line. Passing the flag must be a usage
    // error.
    const r = await runCli([
      "schema",
      "diff",
      "com.x.A",
      "com.x.B",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});

// =============================================================================
// `--quiet` acceptance on the v0.8 migrate verbs
// =============================================================================
//
// The canonical migrate dispatch tests in `schema-migrate-dispatch.test.ts`
// already cover `--root` / `--json` acceptance, missing/excess operands,
// no `apply`, and no `--force`. This block is the symmetric `--quiet`
// row for the migrate verbs — `argv.test.ts` is the canonical home
// for "is flag X accepted on verb Y?" assertions and the migrate
// verbs should be reachable here for the same reason the v0.7 verbs
// are.

describe("argv — `--quiet` is accepted on every migrate verb", () => {
  it("`schema migrate list --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate plan <a> <b> <c> --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "plan",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate verify --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "verify",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema migrate stub <a> <b> <c> --quiet` parses", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.x.X",
      "1.0.0",
      "2.0.0",
      "--quiet",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });
});

describe("argv — `[pattern]` positional acceptance", () => {
  it("`schema check <pattern>` parses (no USAGE_ERROR)", async () => {
    const r = await runCli([
      "schema",
      "check",
      "**/*.no-match.ts",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`schema generate <pattern>` parses (no USAGE_ERROR)", async () => {
    const r = await runCli([
      "schema",
      "generate",
      "**/*.no-match.ts",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).not.toBe(EXIT_CODES.USAGE_ERROR);
  });
});

describe("argv — extra positionals on verbs that take none", () => {
  // commander reports an excess-arguments error by default on
  // commands without trailing positionals. `list` declares no
  // positional → an extra arg is a usage error.
  it("`schema list <extra>` returns USAGE_ERROR", async () => {
    const r = await runCli(["schema", "list", "extra", "--root", emptyRoot]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  // `diff <a> <b>` declares exactly two positionals → a third is
  // a usage error.
  it("`schema diff a b c` returns USAGE_ERROR (third arg)", async () => {
    const r = await runCli([
      "schema",
      "diff",
      "com.x.A",
      "com.x.B",
      "com.x.C",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });
});
