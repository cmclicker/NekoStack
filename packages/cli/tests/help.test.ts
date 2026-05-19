/**
 * Step 35 — `--help` output gate tests.
 *
 * Locks the **stable essentials** of each help screen — not a brittle
 * snapshot of the entire commander-generated text. The contract:
 *
 *   - root help mentions `schema`
 *   - `schema --help` lists the four locked verbs
 *   - each verb's help lists its accepted positionals and flags
 *   - `diff` specifically does NOT advertise `--quiet`
 *   - every help invocation exits SUCCESS and writes to stdout
 *     (never stderr)
 *
 * Uses the shared `runCli` harness. No subprocess spawn.
 */
import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "../src/cli.js";
import { runCli } from "./cli-harness.js";

// =============================================================================
// Root help
// =============================================================================

describe("`neko --help`", () => {
  it("exits SUCCESS, writes stdout, writes nothing to stderr", async () => {
    const r = await runCli(["--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  it("mentions the `schema` command group", async () => {
    const r = await runCli(["--help"]);
    expect(r.stdout).toMatch(/\bschema\b/);
  });

  it("includes the basic commander help shape (`Usage:` / `Commands:`)", async () => {
    const r = await runCli(["--help"]);
    expect(r.stdout.toLowerCase()).toMatch(/usage/);
    expect(r.stdout.toLowerCase()).toMatch(/commands|options/);
  });
});

// =============================================================================
// `schema --help` lists the four verbs
// =============================================================================

describe("`neko schema --help`", () => {
  it("exits SUCCESS and writes to stdout only", async () => {
    const r = await runCli(["schema", "--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  it.each(["list", "diff", "check", "generate"] as const)(
    "lists the `%s` verb",
    async (verb) => {
      const r = await runCli(["schema", "--help"]);
      expect(r.stdout).toMatch(new RegExp(`\\b${verb}\\b`));
    },
  );
});

// =============================================================================
// Per-verb help — accepted positionals + flags
// =============================================================================

describe("`neko schema list --help`", () => {
  it("exits SUCCESS, stdout only", async () => {
    const r = await runCli(["schema", "list", "--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
  });

  it.each(["--root", "--json", "--quiet"] as const)(
    "advertises `%s`",
    async (flag) => {
      const r = await runCli(["schema", "list", "--help"]);
      expect(r.stdout).toContain(flag);
    },
  );
});

describe("`neko schema diff --help`", () => {
  it("exits SUCCESS, stdout only", async () => {
    const r = await runCli(["schema", "diff", "--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
  });

  it("advertises the two positional operands `<a>` and `<b>`", async () => {
    const r = await runCli(["schema", "diff", "--help"]);
    expect(r.stdout).toMatch(/<a>/);
    expect(r.stdout).toMatch(/<b>/);
  });

  it.each(["--root", "--json"] as const)(
    "advertises `%s`",
    async (flag) => {
      const r = await runCli(["schema", "diff", "--help"]);
      expect(r.stdout).toContain(flag);
    },
  );

  it("does NOT advertise `--quiet` (locked surface omits it on diff)", async () => {
    const r = await runCli(["schema", "diff", "--help"]);
    expect(r.stdout).not.toContain("--quiet");
  });
});

describe("`neko schema check --help`", () => {
  it("exits SUCCESS, stdout only", async () => {
    const r = await runCli(["schema", "check", "--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
  });

  it("advertises the `[pattern]` positional", async () => {
    const r = await runCli(["schema", "check", "--help"]);
    expect(r.stdout).toMatch(/\[pattern\]/);
  });

  it.each(["--root", "--json", "--quiet"] as const)(
    "advertises `%s`",
    async (flag) => {
      const r = await runCli(["schema", "check", "--help"]);
      expect(r.stdout).toContain(flag);
    },
  );
});

describe("`neko schema generate --help`", () => {
  it("exits SUCCESS, stdout only", async () => {
    const r = await runCli(["schema", "generate", "--help"]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
  });

  it("advertises the `[pattern]` positional", async () => {
    const r = await runCli(["schema", "generate", "--help"]);
    expect(r.stdout).toMatch(/\[pattern\]/);
  });

  it.each(["--root", "--json", "--quiet"] as const)(
    "advertises `%s`",
    async (flag) => {
      const r = await runCli(["schema", "generate", "--help"]);
      expect(r.stdout).toContain(flag);
    },
  );
});
