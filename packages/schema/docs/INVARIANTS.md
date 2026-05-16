# @nekostack/schema — Invariants

Doctrine that constrains every future phase. If a change violates one, it must be raised explicitly — not worked around silently. Tests alone are not enough; invariants are how the package stays coherent across years of evolution.

1. **IR is the only generator input.** Generators consume `SchemaNode`. They never accept a `Schema` instance, never pattern-match against a builder subclass, never read private fields. The DSL is replaceable; the IR is not.

2. **The public API is intentionally small.** Anything not re-exported from `src/index.ts` is internal and may change without a major version bump. New public exports require deliberate justification.

3. **Type inference follows the absence-semantics table.** [`ABSENCE_SEMANTICS.md`](./ABSENCE_SEMANTICS.md) is authoritative. Modifier methods that drift from it must be rejected.

4. **Defaults are input-optional and output-required.** A `.default(v)` field accepts a missing input and produces a fully-populated output. The `Schema` base class tracks `TInputKey` and `TOutputKey` separately to encode this at the type level.

5. **Object schemas are strict by default.** Unknown keys are rejected unless the consumer opts into `stripUnknown()` or `passthrough()`. Auth, API, and config schemas depend on this; permissive behavior must be deliberate.

6. **Builder operations are immutable.** Every chainable method returns a new schema. The underlying IR is deep-frozen on construction; mutation throws in strict mode. No method on any builder may mutate `this`.

7. **Runtime-only semantics must be explicitly marked.** Custom refinements, transforms, and `dateObject()` are runtime-only. The IR distinguishes portable refinements from runtime-only ones so non-runtime generators (JSON Schema, OpenAPI) can emit semantic-loss metadata rather than silently lying.

8. **No downstream NekoStack package may be imported.** `@nekostack/schema` is foundational. Importing from `@nekostack/api`, `@nekostack/auth`, or any other NekoStack package creates a circular dependency at the architectural level even when the file-level import resolves. External deps (Zod, etc.) are classified per [`SCOPE.md`](./SCOPE.md).

---

## Phase-specific corollaries

These derive from the eight invariants above and apply at specific phases.

- **v0.2 (TS + Zod generators):** Generators must take a `SchemaNode` argument. A function signature of `generateZod(schema: StringSchema)` violates Invariant 1.
- **v0.3 (JSON Schema):** A runtime-only refinement (Invariant 7) MUST emit `x-nekostack-runtime-refinement: true` rather than be omitted silently.
- **v0.5 (composition):** `merge()` with conflicting fields throws by default. Silent merge replacement violates Invariant 5's spirit (deliberateness).
- **v0.6 (runtime):** `validate(schema, input)` may not apply defaults or run transforms. `parse(schema, input)` does both. Anything else violates Invariant 3.
- **v0.7 (registry):** Schema identity collisions across packages at the same version are an error, not "last writer wins."
