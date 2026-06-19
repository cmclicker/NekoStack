# Migrating to NekoStack Schema

> The definitive guide to moving from Zod (or raw JSON Schema) to a single-source-of-truth architecture.

## The Problem: The "Silent Lie" of Modern Web Dev

Every senior engineer has the same horror story: A developer adds a new optional field to a database table. They update the Prisma model. They update the TypeScript interface. They forget to update the Zod validator on the API route.

Two months later, an integration partner complains their webhook is broken because the payload is missing a field the OpenAPI docs promised. The docs were generated from an outdated interface, the API is validating against an outdated Zod schema, and the database is rejecting nulls. 

You have a "Silent Lie" in your architecture. Your contracts drifted because **you were trying to maintain the same shape in three different languages.**

## The Solution: The Intermediate Representation (IR)

`@nekostack/schema` solves this by forcing you to define the shape **once**, in a specialized DSL. That definition is compiled into an Intermediate Representation (IR). 

From that IR, the system generates:
1. Your Zod validators.
2. Your TypeScript types.
3. Your OpenAPI 3.1 Components.
4. Your JSON Schema specifications.

When you change the definition, **every artifact updates instantly**. Drift becomes mathematically impossible.

---

## Step 1: The Basic Rewrite

Let's convert a standard Zod schema to NekoStack.

**Before (Zod):**
```ts
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member")
});

export type User = z.infer<typeof UserSchema>;
```

**After (NekoStack):**
```ts
import { s } from "@nekostack/schema";

export const User = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  role: s.enum(["admin", "member"]).default("member")
})
  .id("com.nekostack.auth.User")
  .version("1.0.0")
  .describe("The authenticated user record.");

// s.infer works exactly like z.infer
export type UserType = s.infer<typeof User>;
```

### What changed?
1. `z` became `s`. The DSL is nearly identical.
2. **The "Insurance Policy":** We added `.id()`, `.version()`, and `.describe()`. 

**Why the ID?** Zod schemas are anonymous. If you want to safely migrate millions of user records from v1.0.0 to v2.0.0, the system needs to know *what* it is migrating. The reverse-DNS ID (`com.nekostack.auth.User`) gives your data a permanent address in the registry, ensuring you never accidentally apply a `Tenant` migration to a `User` record.

---

## Step 2: The "Magic Moment" (Generation)

Once you define your schema, you no longer write types or OpenAPI specs by hand. 

Run the CLI:
```bash
neko schema generate src/schemas/user.schema.ts
```

This generates four files alongside your source:
* `user.zod.ts`: A fully functioning Zod 3.x schema.
* `user.d.ts`: Your clean TypeScript definitions.
* `user.openapi.json`: Your OpenAPI 3.1 component.
* `user.json.schema.json`: Your Draft 2020-12 specification.

You just automated away 20% of your maintenance work.

### Visualizing the Truth
**Why the IR is not a lossy process:** In many generators, you lose metadata (like JSDoc descriptions or custom validation tags) when moving from a schema to an OpenAPI spec. NekoStack IR is designed as a **Super-Set.** It captures the structural intent *and* the descriptive metadata of your schema. When you generate an OpenAPI spec, you aren't guessing—you are projecting the IR into the OpenAPI standard. If the IR contains a rule that OpenAPI cannot represent, NekoStack will stop the build, preventing you from shipping an API doc that lies about your actual runtime behavior.

---

## Step 3: Runtime Validation

You do **not** import Zod to validate your data. `@nekostack/schema` absorbs the workflow to provide a stricter, safer guarantee.

```ts
import { parse, safeParse, validate } from "@nekostack/schema";

// 1. Parse (Throws on failure, fills defaults)
const user = parse(User, req.body); 

// 2. SafeParse (Returns a Result, fills defaults)
const result = safeParse(User, req.body);
if (!result.success) {
  // result.issues uses stable NekoStack IssueCodes, not raw Zod strings
  console.log(result.issues[0].code); // "invalid_type"
}

// 3. Validate (Structural check only. Does NOT fill defaults)
const isValid = validate(User, req.body);
```

### The "Validate vs. Parse" Split
Zod conflates "checking" data with "mutating/filling" data. NekoStack splits them. If you are validating an incoming webhook, you want `parse` (to fill the default `role: "member"`). If you are verifying a database row you just read, you want `validate` (to ensure it is structurally sound without accidentally overwriting data).

---

## Step 4: The Safety Net (CI/CD)

The true value of NekoStack isn't saving keystrokes; it's saving production.

When you run `neko schema check` in your CI pipeline, the system verifies the **IR Hash** embedded in every generated artifact. 

If a developer changes the `User` schema but forgets to run `generate` and commits the PR, the CI build will fail instantly with a `Stale Artifact` error. **The Silent Lie is dead.**

---

## Deep Dive: Nuances & Gaps

While moving from Zod is mostly copy-paste, you must be aware of NekoStack's stricter safety boundaries:

### 1. `null` vs `undefined`
Zod is often loose with absence. NekoStack is literal.
* `.optional()` means the key can be missing (undefined).
* `.nullable()` means the value can literally be `null`.
* `.nullish()` means both.
If you define a field as `.default("x")`, NekoStack treats it as **input-optional, but output-required**.

### 2. Transform Precedence
When a field has both a `.default()` and a `.transform()`, **NekoStack applies the default first**. The transform function will always receive the defaulted value, never `undefined`. This ensures your database mutations have a predictable starting state, an edge case raw Zod leaves ambiguous.

### 3. Recursive Schemas (`s.lazy()`)
In Zod, you can create infinitely recursive anonymous schemas. In NekoStack, any schema referenced by `s.lazy()` **must** have an `.id()`. This forces you to name your recursive structures, ensuring the generated JSON Schema can emit valid `$ref` URLs rather than creating infinite expansion loops.

---

## Next Steps

1. Read the [Issue Codes Catalog](./ISSUE_CODES.md) to see how NekoStack normalizes errors.
2. See [EXAMPLES.md](./EXAMPLES.md) for advanced compositions (`pick`, `omit`, `extend`).
3. Ready for the next level? Learn how to safely evolve your data with [Migrations](./MIGRATIONS.md).
