import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { Secret } from '../src/secret.js';

describe('Secret', () => {
  it('reveals the underlying value via .reveal()', () => {
    const s = new Secret('super-secret-value');
    expect(s.reveal()).toBe('super-secret-value');
  });

  it('redacts when cast to string', () => {
    const s = new Secret('my-password');
    expect(String(s)).toBe('[REDACTED]');
    expect(`${s}`).toBe('[REDACTED]');
  });

  it('redacts via toString()', () => {
    const s = new Secret('my-password');
    expect(s.toString()).toBe('[REDACTED]');
  });

  it('redacts when serialized to JSON', () => {
    const s = new Secret('my-password');
    expect(JSON.stringify(s)).toBe('"[REDACTED]"');
  });

  it('redacts when nested inside a JSON object', () => {
    const s = new Secret('my-api-key');
    const obj = { key: s, name: 'test' };
    const result = JSON.parse(JSON.stringify(obj)) as { key: string; name: string };
    expect(result.key).toBe('[REDACTED]');
    expect(result.name).toBe('test');
  });

  it('redacts via node util.inspect', () => {
    const s = new Secret('db-password');
    expect(inspect(s)).toBe('[REDACTED]');
  });

  it('wraps numbers', () => {
    const s = new Secret(12345);
    expect(s.reveal()).toBe(12345);
    expect(String(s)).toBe('[REDACTED]');
  });

  it('wraps booleans', () => {
    const s = new Secret(true);
    expect(s.reveal()).toBe(true);
    expect(s.toString()).toBe('[REDACTED]');
  });

  it('wraps objects without leaking their properties', () => {
    const obj = { token: 'abc', expires: 123 };
    const s = new Secret(obj);
    expect(s.reveal()).toBe(obj);
    expect(JSON.stringify({ wrapped: s })).toBe('{"wrapped":"[REDACTED]"}');
  });
});
