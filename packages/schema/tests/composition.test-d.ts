import { describe, expectTypeOf, it } from "vitest";
import { s } from "../src/index.js";

const Base = s.object({
  id: s.string(),
  name: s.string(),
  age: s.number(),
});

describe("extend: type inference", () => {
  it("adds new fields to the inferred type", () => {
    const E = Base.extend({ tag: s.string() });
    type T = s.infer<typeof E>;
    expectTypeOf<T>().toEqualTypeOf<{
      id: string;
      name: string;
      age: number;
      tag: string;
    }>();
  });
});

describe("pick / omit: type inference", () => {
  it("pick narrows", () => {
    const P = Base.pick({ id: true, name: true });
    type T = s.infer<typeof P>;
    expectTypeOf<T>().toEqualTypeOf<{ id: string; name: string }>();
  });

  it("omit narrows", () => {
    const O = Base.omit({ age: true });
    type T = s.infer<typeof O>;
    expectTypeOf<T>().toEqualTypeOf<{ id: string; name: string }>();
  });
});

describe("partial: type inference (Decision #6 + #9 + #15)", () => {
  it("makes all fields optional in output", () => {
    const P = Base.partial();
    type T = s.infer<typeof P>;
    expectTypeOf<T>().toEqualTypeOf<{
      id?: string | undefined;
      name?: string | undefined;
      age?: number | undefined;
    }>();
  });

  it("default-bearing field becomes output-optional (default stripped at IR; type widens)", () => {
    const A = s.object({ role: s.string().default("member") });
    const P = A.partial();
    type Out = s.output<typeof P>;
    type In = s.input<typeof P>;
    expectTypeOf<Out>().toEqualTypeOf<{ role?: string | undefined }>();
    expectTypeOf<In>().toEqualTypeOf<{ role?: string | undefined }>();
  });
});

describe("required: type inference (Decision #8 + #9 + #15)", () => {
  it("makes all fields required in output", () => {
    const A = s.object({
      id: s.string().optional(),
      name: s.string().optional(),
    });
    const R = A.required();
    type T = s.infer<typeof R>;
    expectTypeOf<T>().toEqualTypeOf<{ id: string; name: string }>();
  });

  it("default-bearing field becomes output-required (default stripped at IR; type narrows)", () => {
    const A = s.object({ role: s.string().default("member") });
    const R = A.required();
    type Out = s.output<typeof R>;
    type In = s.input<typeof R>;
    expectTypeOf<Out>().toEqualTypeOf<{ role: string }>();
    expectTypeOf<In>().toEqualTypeOf<{ role: string }>();
  });
});

describe("merge: overload-selected return types", () => {
  const A = s.object({ id: s.string() });
  const B = s.object({ name: s.string() });

  it("disjoint merge with no options", () => {
    const M = A.merge(B);
    type T = s.infer<typeof M>;
    expectTypeOf<T>().toMatchTypeOf<{ id: string; name: string }>();
  });

  it("conflict: 'left' selects MergeLeftShape", () => {
    const A2 = s.object({ shared: s.string() });
    const B2 = s.object({ shared: s.number() });
    const M = A2.merge(B2, { conflict: "left" });
    type T = s.infer<typeof M>;
    expectTypeOf<T>().toMatchTypeOf<{ shared: string }>();
  });

  it("conflict: 'right' selects MergeRightShape", () => {
    const A2 = s.object({ shared: s.string() });
    const B2 = s.object({ shared: s.number() });
    const M = A2.merge(B2, { conflict: "right" });
    type T = s.infer<typeof M>;
    expectTypeOf<T>().toMatchTypeOf<{ shared: number }>();
  });

  it("unknownKeys-only options use the default (throw) overload", () => {
    // Proves the default overload accepts MergeOptions even when `conflict`
    // is omitted — this was the round-2 amendment fix.
    const M1 = A.merge(B, { unknownKeys: "left" });
    const M2 = A.merge(B, { unknownKeys: "right" });
    type T1 = s.infer<typeof M1>;
    type T2 = s.infer<typeof M2>;
    expectTypeOf<T1>().toMatchTypeOf<{ id: string; name: string }>();
    expectTypeOf<T2>().toMatchTypeOf<{ id: string; name: string }>();
  });

  it("conflict + unknownKeys together selects the conflict overload", () => {
    const A2 = s.object({ shared: s.string() });
    const B2 = s.object({ shared: s.number() });
    const M = A2.merge(B2, { conflict: "left", unknownKeys: "right" });
    type T = s.infer<typeof M>;
    expectTypeOf<T>().toMatchTypeOf<{ shared: string }>();
  });
});

describe("override: type inference (Decision #2 + #15)", () => {
  it("replaces a field with a different schema type", () => {
    const O = Base.override({ id: s.number() });
    type T = s.infer<typeof O>;
    expectTypeOf<T>().toEqualTypeOf<{ id: number; name: string; age: number }>();
  });
});
