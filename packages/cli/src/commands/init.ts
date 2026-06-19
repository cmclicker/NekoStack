import fs from 'node:fs';
import path from 'node:path';
import { applyTemplate } from "@nekostack/templates";
import { EXIT_CODES, type ExitCode } from "../exit-codes.js";

export interface InitOptions {
  name: string;
  cwd?: string;
  stdout?: (s: string) => void;
}

/**
 * The `neko init` command implementation.
 * Scaffolds a new NekoStack project from the standard web starter.
 */
export async function runInit(opts: InitOptions): Promise<ExitCode> {
  const { name, cwd = process.cwd(), stdout = (s) => process.stdout.write(s) } = opts;
  
  const destDir = path.resolve(cwd, name);
  const sourceDir = path.resolve(import.meta.dirname, '../../../../starters/web/standard');

  if (fs.existsSync(destDir)) {
    process.stderr.write(`Error: Directory already exists: ${destDir}\n`);
    return EXIT_CODES.IO_ERROR;
  }

  stdout(`Initializing new NekoStack project: ${name}...\n`);

  try {
    await applyTemplate({
      sourceDir,
      destDir,
      variables: {
        'project.name': name,
        'project.id': `com.nekostack.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      }
    });

    stdout(`Successfully initialized ${name} at ${destDir}\n`);
    stdout(`\nNext steps:\n`);
    stdout(`  1. cd ${name}\n`);
    stdout(`  2. npm install\n`);
    stdout(`  3. npm run neko:generate\n`);

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_CODES.IO_ERROR;
  }
}
