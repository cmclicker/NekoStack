import { describe, it, expect } from 'vitest';
import { defineConfig, c, Secret, ConfigValidationError } from '../src/index.js';

// All tests pass _env directly to avoid filesystem dotenv loading
const NO_FILES = { _env: {} };

describe('defineConfig — valid config', () => {
  it('returns typed values from env', () => {
    const config = defineConfig(
      {
        env: c.enum(['development', 'production'] as const),
        api: {
          port: c.number().int().min(1).max(65535),
        },
      },
      { _env: { ENV: 'production', API_PORT: '4000' } },
    );

    expect(config.env).toBe('production');
    expect(config.api.port).toBe(4000);
  });

  it('applies default values when env var is absent', () => {
    const config = defineConfig(
      { port: c.number().default(3001) },
      NO_FILES,
    );
    expect(config.port).toBe(3001);
  });

  it('returns undefined for optional fields when not set', () => {
    const config = defineConfig(
      { region: c.string().optional() },
      NO_FILES,
    );
    expect(config.region).toBeUndefined();
  });

  it('wraps secret fields in Secret<T>', () => {
    const config = defineConfig(
      { dbUrl: c.string().secret() },
      { _env: { DB_URL: 'postgres://localhost/mydb' } },
    );
    expect(config.dbUrl).toBeInstanceOf(Secret);
    expect(config.dbUrl.reveal()).toBe('postgres://localhost/mydb');
    expect(String(config.dbUrl)).toBe('[REDACTED]');
  });

  it('respects .env() override for env var name', () => {
    const config = defineConfig(
      { dbUrl: c.string().env('DATABASE_URL') },
      { _env: { DATABASE_URL: 'postgres://localhost/db' } },
    );
    expect(config.dbUrl).toBe('postgres://localhost/db');
  });

  it('coerces number from string env var', () => {
    const config = defineConfig(
      { workers: c.number().int() },
      { _env: { WORKERS: '8' } },
    );
    expect(config.workers).toBe(8);
    expect(typeof config.workers).toBe('number');
  });

  it("coerces boolean from 'true' string", () => {
    const config = defineConfig(
      { debug: c.boolean() },
      { _env: { DEBUG: 'true' } },
    );
    expect(config.debug).toBe(true);
  });

  it('handles deeply nested shapes', () => {
    const config = defineConfig(
      {
        auth: {
          jwt: {
            secret: c.string().secret(),
            expiresIn: c.string().default('1h'),
          },
        },
      },
      { _env: { AUTH_JWT_SECRET: 'my-long-secret-value' } },
    );
    expect(config.auth.jwt.secret).toBeInstanceOf(Secret);
    expect(config.auth.jwt.secret.reveal()).toBe('my-long-secret-value');
    expect(config.auth.jwt.expiresIn).toBe('1h');
  });

  it('secret default wraps default value in Secret<T>', () => {
    const config = defineConfig(
      { token: c.string().default('fallback-token').secret() },
      NO_FILES,
    );
    expect(config.token).toBeInstanceOf(Secret);
    expect(config.token.reveal()).toBe('fallback-token');
  });

  it('validates enum values', () => {
    const config = defineConfig(
      { env: c.enum(['dev', 'prod'] as const) },
      { _env: { ENV: 'dev' } },
    );
    expect(config.env).toBe('dev');
  });
});

describe('defineConfig — validation errors', () => {
  it('throws ConfigValidationError when a required field is missing', () => {
    expect(() =>
      defineConfig({ dbUrl: c.string() }, NO_FILES),
    ).toThrow(ConfigValidationError);
  });

  it('error message names the env var key', () => {
    let error: ConfigValidationError | undefined;
    try {
      defineConfig({ dbUrl: c.string() }, NO_FILES);
    } catch (e) {
      if (e instanceof ConfigValidationError) error = e;
    }
    expect(error).toBeDefined();
    expect(error?.message).toContain('DB_URL');
  });

  it('error message says "required but not set" for missing required fields', () => {
    let error: ConfigValidationError | undefined;
    try {
      defineConfig({ apiKey: c.string() }, NO_FILES);
    } catch (e) {
      if (e instanceof ConfigValidationError) error = e;
    }
    expect(error?.errors[0]?.message).toBe('required but not set');
  });

  it('collects all errors at once — does not stop at first failure', () => {
    let error: ConfigValidationError | undefined;
    try {
      defineConfig(
        { a: c.string(), b: c.number(), c: c.enum(['x'] as const) },
        NO_FILES,
      );
    } catch (e) {
      if (e instanceof ConfigValidationError) error = e;
    }
    expect(error?.errors.length).toBe(3);
  });

  it('throws when enum value is out of range', () => {
    expect(() =>
      defineConfig(
        { env: c.enum(['development', 'production'] as const) },
        { _env: { ENV: 'staging' } },
      ),
    ).toThrow(ConfigValidationError);
  });

  it('throws when string fails minLength constraint', () => {
    expect(() =>
      defineConfig(
        { secret: c.string().minLength(32) },
        { _env: { SECRET: 'short' } },
      ),
    ).toThrow(ConfigValidationError);
  });

  it('throws when number fails min constraint', () => {
    expect(() =>
      defineConfig(
        { port: c.number().min(1024) },
        { _env: { PORT: '80' } },
      ),
    ).toThrow(ConfigValidationError);
  });

  it('includes nested field path in error', () => {
    let error: ConfigValidationError | undefined;
    try {
      defineConfig({ auth: { secret: c.string() } }, NO_FILES);
    } catch (e) {
      if (e instanceof ConfigValidationError) error = e;
    }
    expect(error?.errors[0]?.path).toEqual(['auth', 'secret']);
    expect(error?.errors[0]?.envKey).toBe('AUTH_SECRET');
  });
});
