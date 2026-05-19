// Throws at module load. The walker should aggregate this into the
// `failures` array without short-circuiting the rest of the walk.

throw new Error("intentional walk-fixture failure");

export const _unreached = 0;
