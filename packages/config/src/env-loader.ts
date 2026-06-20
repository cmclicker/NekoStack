import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

/**
 * Loads environment variables following dotenv precedence (lowest → highest):
 *   .env
 *   .env.local
 *   .env.<NODE_ENV>
 *   .env.<NODE_ENV>.local
 *   OS process.env
 *
 * Later sources win. Returns a merged flat Record of all env vars.
 * Never throws for missing files — each file is silently skipped if absent.
 */
export function loadEnv(
  nodeEnv: string | undefined,
  cwd: string = process.cwd(),
): Record<string, string | undefined> {
  const files: string[] = ['.env', '.env.local'];
  if (nodeEnv) {
    files.push(`.env.${nodeEnv}`);
    files.push(`.env.${nodeEnv}.local`);
  }

  // Start from a fresh object — we layer sources manually so we control precedence
  const merged: Record<string, string | undefined> = {};

  for (const file of files) {
    const path = resolve(cwd, file);
    if (!fileExists(path)) continue;
    const result = dotenvConfig({ path, override: false, processEnv: {} });
    if (result.parsed) {
      Object.assign(merged, result.parsed);
    }
  }

  // OS environment wins over all dotenv files
  Object.assign(merged, process.env);

  return merged;
}

function fileExists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive the env var key from a nested config path.
 *
 * ['auth', 'jwtSecret'] → 'AUTH_JWT_SECRET'
 * ['api', 'port']       → 'API_PORT'
 * ['env']               → 'ENV'
 */
export function pathToEnvKey(path: string[]): string {
  return path
    .map(segment => camelToScreaming(segment))
    .join('_');
}

function camelToScreaming(s: string): string {
  return s
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
}
