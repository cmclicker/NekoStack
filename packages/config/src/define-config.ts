import { loadEnv } from './env-loader.js';
import { validateShape } from './validator.js';
import type { InferShape } from './field.js';

export interface DefineConfigOptions {
  /**
   * Override the raw env source — skips dotenv file loading and uses
   * this object directly. Pass process.env or a test fixture here.
   * When omitted, dotenv files are loaded with NODE_ENV precedence.
   */
  _env?: Record<string, string | undefined>;
}

/**
 * Define and validate a typed config schema at call time.
 *
 * The shape is a nested object of `c.*` field builders. On first call,
 * dotenv files are loaded in precedence order and merged with the OS
 * environment, then every field is validated. If any required field is
 * missing or malformed, a single `ConfigValidationError` is thrown
 * listing all problems — the process should not continue.
 *
 * @example
 * ```ts
 * import { defineConfig, c } from '@nekostack/config';
 *
 * export const config = defineConfig({
 *   env: c.enum(['development', 'staging', 'production'] as const),
 *   api: {
 *     port: c.number().int().min(1024).max(65535).default(3001),
 *   },
 *   db: {
 *     url: c.string().url().secret(),
 *   },
 * });
 * ```
 */
export function defineConfig<Shape extends Record<string, unknown>>(
  shape: Shape,
  options?: DefineConfigOptions,
): InferShape<Shape> {
  const rawEnv = options?._env ?? loadEnv(process.env.NODE_ENV);
  return validateShape(shape, rawEnv) as InferShape<Shape>;
}
