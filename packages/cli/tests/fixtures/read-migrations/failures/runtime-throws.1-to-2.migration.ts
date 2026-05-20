// Throws at module evaluation (top level). The loader should record
// this as `runtime_error` and continue with the rest of the walk.

throw new Error("intentional migration-fixture top-level throw");

export const _unreached = 0;
