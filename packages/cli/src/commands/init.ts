import { EXIT_CODES, type ExitCode } from "../exit-codes.js";

export interface InitOptions {
  name: string;
  cwd?: string;
  stdout?: (s: string) => void;
}

// neko init requires the NekoStack monorepo in v1.0 (the project templates
// and the @nekostack/templates scaffolder are not yet published to npm).
// The command is registered so help text and command discovery work correctly;
// the implementation will be wired in a future release once those packages ship.
export async function runInit(opts: InitOptions): Promise<ExitCode> {
  process.stderr.write(
    "neko init is not yet available in the standalone npm package.\n" +
      "Use the NekoStack monorepo directly: https://github.com/cmclicker/NekoStack\n"
  );
  return EXIT_CODES.LOGICAL_FAILURE;
}
