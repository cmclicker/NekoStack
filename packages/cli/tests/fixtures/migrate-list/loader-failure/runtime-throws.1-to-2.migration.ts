// Throws at top-level evaluation — `readMigrations` classifies this
// as `runtime_error`. The command surfaces it as IO_ERROR.

throw new Error("intentional migrate-list runtime failure");

export const _unreached = 0;
