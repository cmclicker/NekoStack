import { describe, it, expect } from 'vitest';
import { pathToEnvKey } from '../src/env-loader.js';

describe('pathToEnvKey', () => {
  it('converts a single camelCase segment', () => {
    expect(pathToEnvKey(['jwtSecret'])).toBe('JWT_SECRET');
  });

  it('converts a nested path', () => {
    expect(pathToEnvKey(['auth', 'jwtSecret'])).toBe('AUTH_JWT_SECRET');
  });

  it('handles simple lowercase paths', () => {
    expect(pathToEnvKey(['env'])).toBe('ENV');
    expect(pathToEnvKey(['api', 'port'])).toBe('API_PORT');
  });

  it('handles deeply nested paths', () => {
    expect(pathToEnvKey(['db', 'primary', 'url'])).toBe('DB_PRIMARY_URL');
  });

  it('handles consecutive uppercase letters (acronyms)', () => {
    expect(pathToEnvKey(['api', 'corsOrigins'])).toBe('API_CORS_ORIGINS');
  });

  it('handles single-word segment at root', () => {
    expect(pathToEnvKey(['port'])).toBe('PORT');
  });

  it('handles camelCase in multi-word segment', () => {
    expect(pathToEnvKey(['auth', 'googleClientId'])).toBe('AUTH_GOOGLE_CLIENT_ID');
  });
});
