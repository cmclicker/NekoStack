// Throws at module evaluation — `walkWorkspace` records this as
// `runtime_error`. The plan command surfaces it as IO_ERROR.

throw new Error("intentional schema-loader failure in migrate-plan fixture");

export const _unreached = 0;
