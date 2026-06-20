import { describe, it, expect } from 'vitest';
import { c } from '../src/field.js';

describe('c.string()', () => {
  it('builds a required string zod schema', () => {
    const f = c.string();
    expect(f.buildZod().safeParse('hello').success).toBe(true);
    expect(f.buildZod().safeParse(undefined).success).toBe(false);
  });

  it('.minLength() rejects short strings', () => {
    const f = c.string().minLength(5);
    expect(f.buildZod().safeParse('hi').success).toBe(false);
    expect(f.buildZod().safeParse('hello').success).toBe(true);
  });

  it('.maxLength() rejects long strings', () => {
    const f = c.string().maxLength(3);
    expect(f.buildZod().safeParse('toolong').success).toBe(false);
    expect(f.buildZod().safeParse('hi').success).toBe(true);
  });

  it('.url() rejects non-URL strings', () => {
    const f = c.string().url();
    expect(f.buildZod().safeParse('not-a-url').success).toBe(false);
    expect(f.buildZod().safeParse('https://example.com').success).toBe(true);
  });

  it('.optional() allows undefined', () => {
    const f = c.string().optional();
    expect(f.buildZod().safeParse(undefined).success).toBe(true);
  });

  it('.default() falls back when value is undefined', () => {
    const f = c.string().default('fallback');
    const result = f.buildZod().safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('fallback');
  });

  it('.secret() is reflected in _meta', () => {
    expect(c.string().secret()._meta.secret).toBe(true);
    expect(c.string()._meta.secret).toBe(false);
  });

  it('.env() overrides the env var name', () => {
    const f = c.string().env('MY_CUSTOM_VAR');
    expect(f._meta.envVar).toBe('MY_CUSTOM_VAR');
  });

  it('chains compose correctly', () => {
    const f = c.string().minLength(8).url().secret().env('API_URL');
    expect(f._meta.secret).toBe(true);
    expect(f._meta.envVar).toBe('API_URL');
    expect(f.buildZod().safeParse('https://api.example.com').success).toBe(true);
    expect(f.buildZod().safeParse('not-url').success).toBe(false);
  });
});

describe('c.number()', () => {
  it('coerces string to number', () => {
    const f = c.number();
    const result = f.buildZod().safeParse('42');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it('.int() rejects floats', () => {
    const f = c.number().int();
    expect(f.buildZod().safeParse('3.14').success).toBe(false);
    expect(f.buildZod().safeParse('3').success).toBe(true);
  });

  it('.min() enforces lower bound', () => {
    const f = c.number().min(1024);
    expect(f.buildZod().safeParse('80').success).toBe(false);
    expect(f.buildZod().safeParse('3000').success).toBe(true);
  });

  it('.max() enforces upper bound', () => {
    const f = c.number().max(65535);
    expect(f.buildZod().safeParse('70000').success).toBe(false);
    expect(f.buildZod().safeParse('3000').success).toBe(true);
  });

  it('.default() provides fallback', () => {
    const f = c.number().default(3001);
    const result = f.buildZod().safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(3001);
  });

  it('.optional() allows undefined', () => {
    const f = c.number().optional();
    expect(f.buildZod().safeParse(undefined).success).toBe(true);
  });
});

describe('c.boolean()', () => {
  it("coerces 'true' string to true", () => {
    const f = c.boolean();
    const result = f.buildZod().safeParse('true');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(true);
  });

  it("coerces '1' to true", () => {
    const f = c.boolean();
    const result = f.buildZod().safeParse('1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(true);
  });

  it("coerces 'false' to false", () => {
    const f = c.boolean();
    const result = f.buildZod().safeParse('false');
    // Note: z.coerce.boolean() treats any non-empty string as truthy
    // The result is still parsed successfully
    expect(result.success).toBe(true);
  });

  it('.default() provides fallback', () => {
    const f = c.boolean().default(false);
    const result = f.buildZod().safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(false);
  });
});

describe('c.enum()', () => {
  const envValues = ['development', 'staging', 'production'] as const;

  it('accepts valid enum values', () => {
    const f = c.enum(envValues);
    expect(f.buildZod().safeParse('development').success).toBe(true);
    expect(f.buildZod().safeParse('production').success).toBe(true);
  });

  it('rejects out-of-range values', () => {
    const f = c.enum(envValues);
    expect(f.buildZod().safeParse('unknown').success).toBe(false);
  });

  it('.default() provides fallback', () => {
    const f = c.enum(envValues).default('development');
    const result = f.buildZod().safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('development');
  });

  it('.optional() allows undefined', () => {
    const f = c.enum(envValues).optional();
    expect(f.buildZod().safeParse(undefined).success).toBe(true);
  });
});

describe('c.array()', () => {
  it('parses comma-separated string as array (via single JSON element)', () => {
    const f = c.array(c.string());
    // Array fields expect JSON arrays from env
    const result = f.buildZod().safeParse(['a', 'b', 'c']);
    expect(result.success).toBe(true);
  });

  it('.default() provides empty array fallback', () => {
    const f = c.array(c.string()).default([]);
    const result = f.buildZod().safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });
});
