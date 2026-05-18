/**
 * Step 2 cache-identity tests (v0.6 plan Decision #7 + #9).
 *
 * Front-loaded from the Step 7 test batch because they directly verify
 * the cache contract introduced by `src/runtime/compile.ts`. Scope is
 * intentionally narrow: identity behavior + that the cached schema
 * still works. No parse / safeParse / validate. No default-stripping.
 * No issue normalization. Those land with their own steps.
 */
import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import * as publicApi from "../src/index.js";
import { compile } from "../src/runtime/compile.js";

describe("compile — cache identity", () => {
  it("same SchemaNode identity returns the same compiled ZodTypeAny instance", () => {
    // One builder output, one `.node`, one identity. Decision #7: that
    // identity is the cache key; repeated `compile()` returns the
    // exact same compiled value, not just an equivalent one.
    const schema = s.string().min(2);
    const a = compile(schema.node);
    const b = compile(schema.node);
    expect(a).toBe(b);
  });

  it("different SchemaNode instances with byte-identical IR do NOT share", () => {
    // Two builder outputs produce two distinct `node` objects with
    // identical IR shape. Decision #7 explicitly rejects sharing
    // across instances — `irHash`-based dedup is a v0.7 registry
    // concern, not the runtime's job.
    const left = s.string().min(2);
    const right = s.string().min(2);
    expect(left.node).not.toBe(right.node);
    expect(JSON.stringify(left.node)).toBe(JSON.stringify(right.node));
    expect(compile(left.node)).not.toBe(compile(right.node));
  });

  it("cached compiled schema still validates input normally", () => {
    // The cache must return a working Zod schema, not a placeholder.
    // First call builds + caches, second call hits the cache — both
    // must validate identically.
    const schema = s.string().min(2);
    const first = compile(schema.node);
    const second = compile(schema.node);
    expect(first.safeParse("ab").success).toBe(true);
    expect(first.safeParse("a").success).toBe(false);
    expect(second.safeParse("ab").success).toBe(true);
    expect(second.safeParse("a").success).toBe(false);
  });

  it("compile is internal-only — not on the public src/index.ts surface", () => {
    // The runtime entry points (parse / safeParse / validate) land in
    // step 6 and the index re-export in step 13. Until then, `compile`
    // must stay internal so external consumers can't bind to a
    // pre-runtime surface and get broken by the later wiring.
    expect("compile" in publicApi).toBe(false);
  });
});
