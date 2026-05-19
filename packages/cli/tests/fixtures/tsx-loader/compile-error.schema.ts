// Intentionally malformed source — esbuild (via tsx) cannot transform
// this file. The loader should classify this as `compile_error`. This
// file is excluded from the package tsconfig so the typecheck pass
// doesn't fail on it.

export const broken =
