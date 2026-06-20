import { z } from 'zod';
import { Secret } from './secret.js';
import type { AnyFieldBuilder } from './field.js';
import { pathToEnvKey } from './env-loader.js';

export class ConfigValidationError extends Error {
  readonly errors: readonly FieldError[];

  constructor(errors: readonly FieldError[]) {
    const lines = errors.map(e => `  ${e.envKey}: ${e.message}`).join('\n');
    super(`Config validation failed:\n${lines}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

export interface FieldError {
  readonly path: string[];
  readonly envKey: string;
  readonly message: string;
}

/**
 * Walk a config shape, parse every field from rawEnv, collect all errors,
 * then either throw a single ConfigValidationError (all problems at once)
 * or return the fully validated result. Secret fields are wrapped in Secret<T>.
 */
export function validateShape(
  shape: Record<string, unknown>,
  rawEnv: Record<string, string | undefined>,
  currentPath: string[] = [],
): Record<string, unknown> {
  const errors: FieldError[] = [];
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(shape)) {
    const path = [...currentPath, key];
    const value = shape[key];

    if (isFieldBuilder(value)) {
      const envKey = value._meta.envVar ?? pathToEnvKey(path);
      const rawValue = rawEnv[envKey];
      const parsed = value.buildZod().safeParse(rawValue);

      if (!parsed.success) {
        errors.push({
          path,
          envKey,
          message: formatZodError(parsed.error, value._meta.hasDefault, value._meta.isOptional),
        });
      } else {
        result[key] = value._meta.secret ? new Secret(parsed.data) : parsed.data;
      }
    } else if (isNestedShape(value)) {
      try {
        result[key] = validateShape(value as Record<string, unknown>, rawEnv, path);
      } catch (e) {
        if (e instanceof ConfigValidationError) {
          errors.push(...e.errors);
        } else {
          throw e;
        }
      }
    }
  }

  if (errors.length > 0) throw new ConfigValidationError(errors);

  return result;
}

function isFieldBuilder(value: unknown): value is AnyFieldBuilder {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_type' in value &&
    (value as { _type: unknown })._type === 'field'
  );
}

function isNestedShape(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isFieldBuilder(value)
  );
}

function formatZodError(error: z.ZodError, hasDefault: boolean, isOptional: boolean): string {
  const issues = error.errors.map(e => e.message);
  if (!hasDefault && !isOptional && issues.includes('Required')) {
    return 'required but not set';
  }
  return issues.join('; ');
}
