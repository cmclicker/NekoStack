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
 * All four schema verbs — `list` (Step 29), `diff` (Step 30),
 * `check` (Step 31), and `generate` (Step 32) — are now wired to
 * real dispatches against the schema-side handlers exposed by
 * `@nekostack/schema/cli`. No placeholders remain.
 *
 * Exit codes follow the locked enum from [`./exit-codes.ts`](./exit-codes.ts)
 * (CLI plan Decision #6). `process.exit` is called exactly once,
 * from `run()`, the production entry. `dispatch()` itself never
 * exits the process — every code path returns an `EXIT_CODES`
 * value.
 */

import { createRequire } from "node:module";
import { Command, CommanderError } from "commander";
import { runCheck } from "./commands/schema/check.js";
import { runDiff } from "./commands/schema/diff.js";
import { runGenerate } from "./commands/schema/generate.js";
import { runList } from "./commands/schema/list.js";
import { runMigrateList } from "./commands/schema/migrate/list.js";
import { runMigratePlan } from "./commands/schema/migrate/plan.js";
import { runMigrateStub } from "./commands/schema/migrate/stub.js";
import { runMigrateVerify } from "./commands/schema/migrate/verify.js";
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

const SCHEMA_VERBS = [
  "list",
  "diff",
  "check",
  "generate",
  "migrate",
] as const;

/**
 * Locked v0.8 `migrate` subcommand verbs (Decision #5 of the v0.8
 * phase plan + the user-locked surface: `list / plan / verify /
 * stub`). No `apply`, no `--force`. The verbs are declared in this
 * order under the `migrate` group; the help-screen test asserts the
 * declaration order is the contract.
 */
const MIGRATE_VERBS = ["list", "plan", "verify", "stub"] as const;

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

  // `schema` command group — all four verbs (`list`, `diff`,
  // `check`, `generate`) wired to real dispatches against the
  // schema-side handlers exposed by `@nekostack/schema/cli`.

  const schema = program
    .command("schema")
    .description(
      "schema commands — list / diff / check / generate (v0.7) + migrate (v0.8)",
    )
    .exitOverride()
    .configureOutput({
      writeOut,
      writeErr,
      outputError: (s, write) => write(s),
    });

  schema
    .command("list")
    .description("enumerate registry entries")
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(async (cmdOpts: { root: string; json: boolean; quiet: boolean }) => {
      const code = await runList({
        root: cmdOpts.root,
        json: cmdOpts.json,
        quiet: cmdOpts.quiet,
        stdout: writeOut,
        stderr: writeErr,
      });
      if (code !== EXIT_CODES.SUCCESS) {
        throw new CommandActionError(code);
      }
    });

  schema
    .command("diff <a> <b>")
    .description(
      "classify a → b as breaking / additive / cosmetic; <a>/<b> are schemaId / schemaId@version / file path",
    )
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .action(
      async (
        a: string,
        b: string,
        cmdOpts: { root: string; json: boolean },
      ) => {
        const code = await runDiff({
          root: cmdOpts.root,
          a,
          b,
          json: cmdOpts.json,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  schema
    .command("check [pattern]")
    .description(
      "freshness gate — exit nonzero on stale / breaking / integrity-error artifacts",
    )
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(
      async (
        pattern: string | undefined,
        cmdOpts: { root: string; json: boolean; quiet: boolean },
      ) => {
        const code = await runCheck({
          root: cmdOpts.root,
          ...(pattern !== undefined ? { pattern } : {}),
          json: cmdOpts.json,
          quiet: cmdOpts.quiet,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  schema
    .command("generate [pattern]")
    .description("regenerate artifacts for matching schema files")
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(
      async (
        pattern: string | undefined,
        cmdOpts: { root: string; json: boolean; quiet: boolean },
      ) => {
        const code = await runGenerate({
          root: cmdOpts.root,
          ...(pattern !== undefined ? { pattern } : {}),
          json: cmdOpts.json,
          quiet: cmdOpts.quiet,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  // ---------------------------------------------------------------------------
  // `schema migrate` subgroup — v0.8 verbs (list / plan / verify / stub).
  //
  // Hard-locked: no `apply` verb, no `--force` flag (`stub` refuses to
  // overwrite unconditionally). `migration.transform` is never invoked
  // here — the four command modules carry static-scan tests proving
  // it, and Master plan Decision #1 plus v0.8 INVARIANTS keep the
  // schema package pure.
  // ---------------------------------------------------------------------------

  const migrate = schema
    .command("migrate")
    .description("v0.8 migrate commands — list / plan / verify / stub")
    .exitOverride()
    .configureOutput({
      writeOut,
      writeErr,
      outputError: (s, write) => write(s),
    });

  migrate
    .command("list")
    .description("enumerate registered migrations")
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(
      async (cmdOpts: { root: string; json: boolean; quiet: boolean }) => {
        const code = await runMigrateList({
          root: cmdOpts.root,
          json: cmdOpts.json,
          quiet: cmdOpts.quiet,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  migrate
    .command("plan <schemaId> <fromVersion> <toVersion>")
    .description(
      "compute the migration chain (or no-migration-needed plan) for a (schemaId, fromVersion, toVersion) triple",
    )
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(
      async (
        schemaId: string,
        fromVersion: string,
        toVersion: string,
        cmdOpts: { root: string; json: boolean; quiet: boolean },
      ) => {
        const code = await runMigratePlan({
          root: cmdOpts.root,
          schemaId,
          fromVersion,
          toVersion,
          json: cmdOpts.json,
          quiet: cmdOpts.quiet,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  migrate
    .command("verify")
    .description(
      "classify every registered migration as bound / cosmetic_drift / drift / missing_endpoint",
    )
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(
      async (cmdOpts: { root: string; json: boolean; quiet: boolean }) => {
        const code = await runMigrateVerify({
          root: cmdOpts.root,
          json: cmdOpts.json,
          quiet: cmdOpts.quiet,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  migrate
    .command("stub <schemaId> <fromVersion> <toVersion>")
    .description(
      "generate a skeleton migration file (refuses to overwrite an existing file)",
    )
    .allowExcessArguments(false)
    .option("--root <path>", "workspace root", process.cwd())
    .option("--json", "machine-readable JSON output", false)
    .option("--quiet", "suppress non-essential stderr output", false)
    .action(
      async (
        schemaId: string,
        fromVersion: string,
        toVersion: string,
        cmdOpts: { root: string; json: boolean; quiet: boolean },
      ) => {
        const code = await runMigrateStub({
          root: cmdOpts.root,
          schemaId,
          fromVersion,
          toVersion,
          json: cmdOpts.json,
          quiet: cmdOpts.quiet,
          stdout: writeOut,
          stderr: writeErr,
        });
        if (code !== EXIT_CODES.SUCCESS) {
          throw new CommandActionError(code);
        }
      },
    );

  return program;
}

/**
 * Carries a chosen `ExitCode` out of a commander `.action()` callback.
 * Action callbacks can't return values that commander surfaces, so a
 * non-zero outcome travels back to `dispatch()` via a throw. The
 * error is plain control-flow — never logged or surfaced to the user.
 */
class CommandActionError extends Error {
  constructor(public readonly exitCode: ExitCode) {
    super(`Command action returned exit code ${exitCode}`);
    this.name = "CommandActionError";
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
    if (err instanceof CommandActionError) {
      return err.exitCode;
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
