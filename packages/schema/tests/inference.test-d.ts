import { describe, expectTypeOf, it } from "vitest";
import { s } from "../src/index.js";

describe("primitive inference", () => {
  it("string → string", () => {
    expectTypeOf<s.infer<ReturnType<typeof s.string>>>().toEqualTypeOf<string>();
  });

  it("number → number", () => {
    expectTypeOf<s.infer<ReturnType<typeof s.number>>>().toEqualTypeOf<number>();
  });

  it("literal preserves the literal", () => {
    const Tag = s.literal("admin");
    expectTypeOf<s.infer<typeof Tag>>().toEqualTypeOf<"admin">();
  });

  it("enum is the union of values", () => {
    const Color = s.enum(["red", "green", "blue"] as const);
    expectTypeOf<s.infer<typeof Color>>().toEqualTypeOf<
      "red" | "green" | "blue"
    >();
  });
});

describe("modifier inference", () => {
  it("optional adds undefined to output", () => {
    const A = s.string().optional();
    expectTypeOf<s.infer<typeof A>>().toEqualTypeOf<string | undefined>();
  });

  it("nullable adds null", () => {
    const A = s.string().nullable();
    expectTypeOf<s.infer<typeof A>>().toEqualTypeOf<string | null>();
  });

  it("nullish adds both", () => {
    const A = s.string().nullish();
    expectTypeOf<s.infer<typeof A>>().toEqualTypeOf<string | null | undefined>();
  });

  it("default narrows output to exclude undefined", () => {
    const A = s.string().default("x");
    expectTypeOf<s.infer<typeof A>>().toEqualTypeOf<string>();
    expectTypeOf<s.input<typeof A>>().toEqualTypeOf<string | undefined>();
  });
});

describe("object inference: absence semantics", () => {
  const User = s.object({
    id: s.string(),                          // required
    nickname: s.string().optional(),         // ?: string | undefined
    avatar: s.string().nullable(),           // : string | null   (still required)
    bio: s.string().nullish(),               // ?: string | null | undefined
    role: s.string().default("member"),      // input ?: string; output: string (required output)
  });

  it("output: optional fields become `key?:`", () => {
    type U = s.infer<typeof User>;
    expectTypeOf<U>().toEqualTypeOf<{
      id: string;
      avatar: string | null;
      role: string;
      nickname?: string | undefined;
      bio?: string | null | undefined;
    }>();
  });

  it("input: default-bearing fields are optional", () => {
    type U = s.input<typeof User>;
    expectTypeOf<U>().toEqualTypeOf<{
      id: string;
      avatar: string | null;
      nickname?: string | undefined;
      bio?: string | null | undefined;
      role?: string | undefined;
    }>();
  });
});

describe("array inference", () => {
  it("array of strings", () => {
    const A = s.array(s.string());
    expectTypeOf<s.infer<typeof A>>().toEqualTypeOf<string[]>();
  });

  it("array of objects", () => {
    const A = s.array(s.object({ id: s.string() }));
    expectTypeOf<s.infer<typeof A>>().toEqualTypeOf<{ id: string }[]>();
  });
});

describe("audit User example — proves the absence-semantics contract verbatim", () => {
  const User = s.object({
    name: s.string(),
    nickname: s.string().optional(),
    bio: s.string().nullable(),
    handle: s.string().nullish(),
    role: s.string().default("member"),
  });

  it("input matches the spec table", () => {
    type Input = s.input<typeof User>;
    expectTypeOf<Input>().toEqualTypeOf<{
      name: string;
      nickname?: string | undefined;
      bio: string | null;
      handle?: string | null | undefined;
      role?: string | undefined;
    }>();
  });

  it("output matches the spec table — default is required, optional/nullish are optional", () => {
    type Output = s.output<typeof User>;
    expectTypeOf<Output>().toEqualTypeOf<{
      name: string;
      nickname?: string | undefined;
      bio: string | null;
      handle?: string | null | undefined;
      role: string;
    }>();
  });
});

describe("nested object inference", () => {
  it("output type prettifies through nesting", () => {
    const Schema = s.object({
      user: s.object({
        id: s.string(),
        tags: s.array(s.string()),
      }),
      count: s.number().int(),
    });
    type T = s.infer<typeof Schema>;
    expectTypeOf<T>().toEqualTypeOf<{
      user: { id: string; tags: string[] };
      count: number;
    }>();
  });
});
