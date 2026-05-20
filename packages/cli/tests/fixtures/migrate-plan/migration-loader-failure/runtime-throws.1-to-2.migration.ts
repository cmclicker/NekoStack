// Throws at module evaluation — `readMigrations` records this as
// `runtime_error`. The plan command surfaces it as IO_ERROR.

throw new Error("intentional migration-loader failure in migrate-plan fixture");

export const _unreached = 0;
