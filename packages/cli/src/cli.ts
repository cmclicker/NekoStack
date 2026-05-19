/**
 * `@nekostack/cli` argv-parse + dispatch entry (v0.7 Step 25).
 *
 * This module is the testable CLI surface — `buildCli()` constructs a
 * configured commander program; `dispatch(argv)` parses an argv array
 * and returns the intended exit code without calling `process.exit`;
 * `run(argv)` is the production entry that wraps `dispatch` and exits
 * the process. The split exists so the in-process test harness
 * (Step 33) can drive the CLI without subprocess spawn (CLI plan
 * Decision #9): tests call `dispatch`, capture stdout/stderr through
 * injected writers, and assert on the returned exit code.
 *
 * Schema-verb implementations land in Steps 29–32. Until then the
 * four `schema` subcommands print a TODO-style stderr message and
 * return exit code 1 — running `neko schema list` against a build
 * cut from any commit before Step 29 produces a clear "not yet
 * implemented" error rather than a silent success.
 *
 * Exit codes follow the locked enum from [`./exit-codes.ts`](./exit-codes.ts)
 * (CLI plan Decision #6). `process.exit` is called exactly once,
 * from `run()`, the production entry. `dispatch()` itself never
 * exits the process — every code path returns an `EXIT_CODES`
 * value.
 */

import { createRequire } from "node:module";
import { Command, CommanderError } from "commander";
import { EXIT_CODES, type ExitCode } from "./exit-codes.js";

// Re-export so existing call sites that imported the enum from
// `cli.ts` keep compiling without churn. `exit-codes.ts` is the
// source of truth.
export { EXIT_CODES, type ExitCode };

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

// =============================================================================
// Builder options + writer injection
// =============================================================================

export interface CliWriters {
  readonly stdout?: (s: string) => void;
  readonly stderr?: (s: string) => void;
}

export interface BuildCliOptions extends CliWriters {
  /** Overrides the version commander reports for `--version`.
   *  Defaults to `@nekostack/cli`'s own `package.json` `version`. */
  readonly version?: string;
}

// =============================================================================
// Builder
// =============================================================================

const SCHEMA_VERBS = ["list", "diff", "check", "generate"] as const;

export function buildCli(opts: BuildCliOptions = {}): Command {
  const writeOut = opts.stdout ?? ((s) => process.stdout.write(s));
  const writeErr = opts.stderr ?? ((s) => process.stderr.write(s));

  const program = new Command()
    .name("neko")
    .description("NekoStack developer CLI")
    .version(
      opts.version ?? pkg.version,
      "-v, --version",
      "print the @nekostack/cli version and exit",
    )
    .helpOption("-h, --help", "show help and exit")
    .exitOverride()
    .configureOutput({
      writeOut,
      writeErr,
      outputError: (s, write) => write(s),
    });

  // `schema` command group. The four subcommand handlers are
  // placeholders that print a stderr TODO message and resolve with a
  // logical-failure exit code; Steps 29–32 replace each one with the
  // wired-up dispatch to `@nekostack/schema/cli`'s pure handlers.

  const schema = program
    .command("schema")
    .description("v0.7 schema commands — list / diff / check / generate")
    .exitOverride()
    .configureOutput({
      writeOut,
      writeErr,
      outputError: (s, write) => write(s),
    });

  schema
    .command("list")
    .description("enumerate registry entries")
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(() => placeholderHandler("list", writeErr));

  schema
    .command("diff <a> <b>")
    .description(
      "classify a → b as breaking / additive / cosmetic; <a>/<b> are schemaId / schemaId@version / file path",
    )
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .action(() => placeholderHandler("diff", writeErr));

  schema
    .command("check [pattern]")
    .description(
      "freshness gate — exit nonzero on stale / breaking / integrity-error artifacts",
    )
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(() => placeholderHandler("check", writeErr));

  schema
    .command("generate [pattern]")
    .description("regenerate artifacts for matching schema files")
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(() => placeholderHandler("generate", writeErr));

  return program;
}

/**
 * Placeholder for the four schema verbs. Steps 29–32 replace each
 * `.action(() => placeholderHandler(...))` with a real dispatch.
 * Throws a `PlaceholderUnimplementedError` so `dispatch()` can map it
 * to `LOGICAL_FAILURE` without coupling the action callback to
 * exit-code semantics.
 */
function placeholderHandler(verb: string, writeErr: (s: string) => void): void {
  writeErr(
    `neko schema ${verb}: not yet implemented in this build (Step 29–32 wires each verb).\n`,
  );
  throw new PlaceholderUnimplementedError(verb);
}

class PlaceholderUnimplementedError extends Error {
  constructor(public readonly verb: string) {
    super(`neko schema ${verb} is not yet implemented`);
    this.name = "PlaceholderUnimplementedError";
  }
}

// =============================================================================
// Dispatch
// =============================================================================

/**
 * Parse `argv` (the user-supplied arguments — what would normally be
 * `process.argv.slice(2)`) and run the matched command. Returns the
 * intended exit code; never calls `process.exit`. The bin entry's
 * `run()` wraps this to actually exit the process.
 *
 * The `writers` slice lets the in-process test harness capture stdout
 * / stderr by passing string-collector functions. When omitted,
 * commander writes through `process.stdout` / `process.stderr` as
 * usual.
 */
export async function dispatch(
  argv: readonly string[],
  opts: BuildCliOptions = {},
): Promise<ExitCode> {
  const program = buildCli(opts);
  try {
    await program.parseAsync(argv, { from: "user" });
    return EXIT_CODES.SUCCESS;
  } catch (err) {
    if (err instanceof PlaceholderUnimplementedError) {
      return EXIT_CODES.LOGICAL_FAILURE;
    }
    if (err instanceof CommanderError) {
      return mapCommanderError(err);
    }
    // Unexpected programmer error — re-throw so it surfaces during
    // development. The CLI dispatch path will gain an explicit
    // "unexpected error" mapping when a real verb introduces a
    // surface that could throw beyond `Issue`s.
    throw err;
  }
}

function mapCommanderError(err: CommanderError): ExitCode {
  // commander's own codes for help / version are success.
  if (
    err.code === "commander.helpDisplayed" ||
    err.code === "commander.help" ||
    err.code === "commander.version"
  ) {
    return EXIT_CODES.SUCCESS;
  }
  // Everything else commander reports is an argv-shape problem — bad
  // flag, missing argument, unknown command, unknown option, etc.
  return EXIT_CODES.USAGE_ERROR;
}

// =============================================================================
// Bin entry
// =============================================================================

/**
 * Production entry — called by `bin/neko`. Dispatches and calls
 * `process.exit` with the returned code. Never returns.
 *
 * Tests do NOT call this — they call `dispatch` directly and assert
 * on the returned `ExitCode`. The CLI plan's Decision #9 (in-process
 * harness) explicitly avoids subprocess spawn, so the only path that
 * touches `process.exit` is this one, and it's called only when the
 * bin shebang script imports the built `dist/cli.js`.
 */
export async function run(argv: readonly string[] = process.argv): Promise<never> {
  const code = await dispatch(argv.slice(2));
  process.exit(code);
}
