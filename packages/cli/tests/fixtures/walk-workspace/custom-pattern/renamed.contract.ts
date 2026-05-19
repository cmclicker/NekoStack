import { s } from "@nekostack/schema";

// A consumer who names their schema files `*.contract.ts` instead of
// `*.schema.ts`. The walker's caller can override the pattern to pick
// these up — and the override must replace, not extend, the default.

export const Renamed = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Renamed")
  .version("1.0.0");
