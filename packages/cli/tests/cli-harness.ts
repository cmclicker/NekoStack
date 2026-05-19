/**
 * In-process CLI test harness (v0.7 Step 33).
 *
 * CLI plan Decision #9: tests drive `dispatch(argv)` directly through
 * collector functions wired into commander's `configureOutput`, not
 * through subprocess spawn. This file extracts the capture pattern
 * that every command test had been inlining and exposes it as a
 * tiny helper.
 *
 * Usage:
 *
 *     import { runCli } from "../cli-harness.js";
 *
 *     const r = await runCli(["schema", "list", "--root", root]);
 *     expect(r.code).toBe(EXIT_CODES.SUCCESS);
 *     expect(r.stdout).toMatch(/...$/);
 *
 * Test-only utility — not exported from the package. Never spawns a
 * subprocess, never touches `process.exit`. The captured `stdout` /
 * `stderr` strings are the exact bytes commander / each command
 * tried to write; the returned `code` is the `ExitCode` `dispatch`
 * resolved with.
 */

import { dispatch, type ExitCode } from "../src/cli.js";

export interface CliRun {
  readonly code: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunCliOptions {
  /** Overrides the version commander reports for `--version`.
   *  Mirrors `BuildCliOptions.version`. Useful for asserting the
   *  version flag without coupling to the live package version. */
  readonly version?: string;
}

/**
 * Run the CLI in-process with `argv` (the user-supplied args — i.e.
 * what would be `process.argv.slice(2)`). Returns the captured
 * stdout / stderr and the resolved `ExitCode`. Does not call
 * `process.exit`.
 */
export async function runCli(
  argv: readonly string[],
  opts: RunCliOptions = {},
): Promise<CliRun> {
  let stdout = "";
  let stderr = "";
  const code = await dispatch(argv, {
    ...opts,
    stdout: (s) => {
      stdout += s;
    },
    stderr: (s) => {
      stderr += s;
    },
  });
  return { code, stdout, stderr };
}
