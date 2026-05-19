// Module throws during evaluation. The loader should classify this as
// `runtime_error` (not `compile_error` — the source parses fine).

throw new Error("intentional fixture failure at module load");

// Unreachable export — kept so the file is syntactically a module.
export const _unreached = 0;
