# Examples — `@nekostack/schema`

Three realistic example schemas under [`../examples/`](../examples/), each with its committed generated artifacts under [`../examples/generated/`](../examples/generated/). These files are validated by [`../tests/examples/regenerate.test.ts`](../tests/examples/regenerate.test.ts): if a schema changes and the generated files aren't refreshed, the test fails.

To regenerate after a deliberate schema change:

```
cd packages/schema
npx vitest run tests/examples/regenerate.test.ts -u
```

(`-u` updates snapshots — the generated files ARE the snapshots.)

## 1. Tenant — basic entity

**Source:** [`../examples/tenant.schema.ts`](../examples/tenant.schema.ts)

**Generated:**
- [`../examples/generated/tenant.types.ts`](../examples/generated/tenant.types.ts) — TS output type
- [`../examples/generated/tenant.zod.ts`](../examples/generated/tenant.zod.ts) — Zod 3.x validator
- [`../examples/generated/tenant.json.schema.json`](../examples/generated/tenant.json.schema.json) — JSON Schema draft 2020-12 (URN `$id`)
- [`../examples/generated/tenant.openapi.json`](../examples/generated/tenant.openapi.json) — OpenAPI 3.1 component schema (no `$schema`, no `$id`; identity is the position in the composed document)

**What it demonstrates:**
- Schema metadata (`.id()`, `.version()`, `.describe()`) in the generated header.
- UUID + email + regex portable refinements.
- Enum field with a default (`plan: "free"`).
- Nullable field (`billingEmail` — required key, value may be `null`).
- Nested object with required + optional fields.
- Strict-by-default object policy → emitted `.strict()` in Zod.

## 2. AuditEvent — the input/output split

**Source:** [`../examples/audit-event.schema.ts`](../examples/audit-event.schema.ts)

**Generated:**
- [`../examples/generated/audit-event.both.ts`](../examples/generated/audit-event.both.ts) — TS, **`mode: "both"`**, emits `AuditEventInput` + `AuditEventOutput` side-by-side
- [`../examples/generated/audit-event.zod.ts`](../examples/generated/audit-event.zod.ts) — Zod 3.x validator
- [`../examples/generated/audit-event.json.schema.json`](../examples/generated/audit-event.json.schema.json) — JSON Schema draft 2020-12 (input-validation; default fields omitted from `required`, `x-nekostack-default-applied-by: "runtime"` on `severity`)
- [`../examples/generated/audit-event.openapi.json`](../examples/generated/audit-event.openapi.json) — OpenAPI 3.1 component schema (same body shape as the JSON Schema above — shared internal fragment emitter; the `irHash` in `x-nekostack` provenance is identical, proving same-source generation)

**Why this is the headline example:**

`AuditEvent.severity` has `.default("info")`. Look at the generated `audit-event.both.ts` — the difference between `Input` and `Output` is one character:

```ts
export type AuditEventInput  = { ...; severity?: "info" | "warning" | "error"; ... };
export type AuditEventOutput = { ...; severity:  "info" | "warning" | "error"; ... };
```

The Input accepts missing `severity` (the default fills it in). The Output is fully populated. The v0.1 absence-semantics contract survives generation — that's the entire point of v0.2.

**Other absence-semantics rows exercised:**
- `correlationId.optional()` → `?:` in both Input and Output
- `actorId.nullable()` → `: string | null` (required key) in both
- `payload` uses `.passthrough()` → emitted `.passthrough()` in Zod; accepts arbitrary extra keys

## 3. Entitlement — array + deprecated + nullable-as-sentinel

**Source:** [`../examples/entitlement.schema.ts`](../examples/entitlement.schema.ts)

**Generated:**
- [`../examples/generated/entitlement.types.ts`](../examples/generated/entitlement.types.ts) — TS output type
- [`../examples/generated/entitlement.zod.ts`](../examples/generated/entitlement.zod.ts) — Zod 3.x validator
- [`../examples/generated/entitlement.json.schema.json`](../examples/generated/entitlement.json.schema.json) — JSON Schema draft 2020-12
- [`../examples/generated/entitlement.openapi.json`](../examples/generated/entitlement.openapi.json) — OpenAPI 3.1 component schema

**What it demonstrates:**
- Boolean with default (`enabled: true`).
- Numeric field with `int + min` portable refinements + nullable (`quota` — null encodes "unlimited", a common SaaS pattern).
- Array with `max` items (`tags`).
- Field-level `.deprecated()` flag (`legacyTier`) — surfaces in JSDoc; consumers using a strict TS-aware tool will see the `@deprecated` tag.
- Mixed required + optional fields in one object.

## Validating input at runtime (v0.6)

Once a schema is defined, `parse` / `safeParse` / `validate` from `@nekostack/schema` are the runtime-validation entry points. The generated Zod file is no longer required to validate input — generators emit artifacts for interoperability and documentation; the runtime API is the in-process path.

### `parse` — throws `ParseError` on failure, fills defaults on success

```ts
import { parse, ParseError } from "@nekostack/schema";
import { AuditEvent } from "../examples/audit-event.schema.js";

try {
  const event = parse(AuditEvent, {
    id: "evt_01",
    occurredAt: "2026-05-18T10:00:00Z",
    actorId: null,
    action: "tenant.created",
    payload: { tenantId: "t_1" },
    // severity omitted — default("info") fills it
  });
  event.severity; // "info" (default filled — see audit-event.both.ts for the type-level reason this works)
} catch (e) {
  if (e instanceof ParseError) {
    for (const i of e.issues) console.log(i.code, i.path, i.message);
  } else {
    throw e;
  }
}
```

### `safeParse` — returns `Result`, no throw, also fills defaults

```ts
import { safeParse } from "@nekostack/schema";
import { Tenant } from "../examples/tenant.schema.js";

const r = safeParse(Tenant, untrustedInput);
if (r.success) {
  // r.data: s.output<typeof Tenant>
} else {
  // r.issues: readonly Issue[] — every issue uses the NekoStack IssueCode vocabulary
}
```

### `validate` — structural check; does **not** fill defaults; refinements still run

```ts
import { validate } from "@nekostack/schema";
import { AuditEvent } from "../examples/audit-event.schema.js";

const r = validate(AuditEvent, {
  id: "evt_01",
  occurredAt: "2026-05-18T10:00:00Z",
  actorId: null,
  action: "tenant.created",
  payload: { tenantId: "t_1" },
  // severity absent — accepted, but NOT filled in r.data
});
if (r.success) {
  // r.data shape matches s.input<typeof AuditEvent>
  // "severity" in r.data === false
}
```

The split: `parse` / `safeParse` apply the default and return the fully-populated output; `validate` accepts the absence and returns the input verbatim. See [`RUNTIME.md` → Default semantics](./RUNTIME.md#default-semantics) for the table and the v0.1 rationale.

### Unknown-key policies execute at runtime

```ts
import { s, parse } from "@nekostack/schema";

const Strict      = s.object({ id: s.string() });                  // default
const Pass        = s.object({ id: s.string() }).passthrough();
const Strip       = s.object({ id: s.string() }).stripUnknown();

parse(Strict, { id: "x", extra: 1 });    // throws ParseError([{ code: "unknown_key", path: ["extra"], ... }])
parse(Pass,   { id: "x", extra: 1 });    // → { id: "x", extra: 1 }
parse(Strip,  { id: "x", extra: 1 });    // → { id: "x" }
```

`unrecognized_keys` is split — when an input has two unknown keys, the returned `issues` array contains two `unknown_key` issues, one per key, each with `path: [...originalPath, key]`. See [`RUNTIME.md` → Unknown-key policies](./RUNTIME.md#unknown-key-policies).

## Reading the generated files

Every committed generated artifact has the deterministic header:

```ts
/**
 * @generated by @nekostack/schema
 * schemaId:         com.nekostack.tenant.Tenant
 * schemaVersion:    1.0.0
 * irHash:           sha256:<64-char-hex>
 * generator:        typescript | zod
 * generatorVersion: @nekostack/schema@0.7.0
 *
 * DO NOT EDIT MANUALLY.
 */
```

Same IR → same `irHash` across runs and across generators. Re-running the regenerate test on an unchanged schema produces byte-identical output. This is what makes v0.7's freshness check possible.

## Composition example (v0.5)

The example schemas above can be composed:

```ts
import { Tenant } from "../examples/tenant.schema.js";

// Create-form input: client doesn't send the server-assigned id.
const TenantCreateInput = Tenant.omit({ id: true });

// PATCH/update shape: every field optional, defaults stripped.
const TenantPatch = Tenant.partial();

// Safe-to-expose subset (e.g., for a tenant directory listing).
const TenantPublic = Tenant.pick({ id: true, slug: true, name: true });
```

All four generators handle composed schemas via the shared `emitSchemaFragment` — output is byte-identical to a hand-written equivalent. See [`COMPOSITION.md`](./COMPOSITION.md) for the full operator contract.

## Optional `sourceHash` provenance (v0.7+)

> The example artifacts in [`../examples/generated/`](../examples/generated/) **include** `sourceHash` because the regenerate test ([`../tests/examples/regenerate.test.ts`](../tests/examples/regenerate.test.ts)) computes it from each schema source file's UTF-8 text. The slice remains **optional** for direct generator callers outside that path — omitting it produces byte-identical output to v0.6 and earlier.

Every generator accepts an optional `ProvenanceOptions.sourceHash` slice on its options object. When you provide it, the emitted artifact gains an extra provenance field (`sourceHash:` line in JSDoc-headered TS/Zod output; `x-nekostack.sourceHash` extension in JSON Schema / OpenAPI). When you omit it, the generators emit byte-identical output to v0.6 and earlier — no new field appears anywhere.

```ts
import { generateTypeScript, sourceHashFromText } from "@nekostack/schema";
import { readFileSync } from "node:fs";
import { Tenant } from "../examples/tenant.schema.js";

const text = readFileSync("../examples/tenant.schema.ts", "utf8");
const ts = generateTypeScript(Tenant.node, {
  sourceHash: sourceHashFromText(text),
});
```

The slice is **not required**, exists purely for provenance, and is **never** an integrity error when missing — pre-v0.7 artifacts without `sourceHash` continue to parse and validate as `clean` (when `irHash` matches the schema) or `stale` (when it doesn't). The two-hash freshness matrix (full contract in [`REGISTRY.md` → `checkHandler`](./REGISTRY.md#checkhandler--two-hash-freshness-matrix)) is the consumer of the field; in v0.7+ the `neko schema check` CLI is what computes and writes it. Hand-authored generation scripts can plug it in today, but the value adds is provenance-completeness, not correctness.

## What these examples deliberately don't show (yet)

- **Full OpenAPI documents** (paths, operations, responses, security schemes) — `@nekostack/api`'s concern. v0.4 ships component schemas only.
- **Composed-schema example artifacts under `examples/generated/`** — could add `tenant-patch.zod.ts` etc. in a future dogfood pass if the example surface grows enough to warrant it. v0.5 stays focused on the operator contract; ad-hoc consumer-side composition doesn't need its own snapshotted output here.
- **`Tenant.extend({ ... })`, `pick({ id: true })`, etc.** — v0.5 composition operators; see [`COMPOSITION.md`](./COMPOSITION.md) for the full contract.
- **Date / union / runtime-refinement schemas** — v0.6's runtime fails loudly (`UnsupportedNodeKindError`) on these IR kinds; builders are deferred to later phases. The v0.7 `diffNodes` likewise throws on these kinds — diffing them is a v0.8+ concern.
- **A `neko schema` CLI** — v0.7 shipped at [`schema-v0.7.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.7.0); use `neko schema list / diff / check / generate` directly. The v0.8 `neko schema migrate *` verbs (`list` / `plan` / `verify` / `stub`) are in progress on [`feat/schema-v0.8-candidate`](https://github.com/cmclicker/NekoStack/tree/feat/schema-v0.8-candidate) ([PR #28](https://github.com/cmclicker/NekoStack/pull/28)) and not yet shipped.
- **Example schema-data migrations under `examples/migrations/`** — v0.8 ships the planning / verification / stub contract in [`MIGRATIONS.md`](./MIGRATIONS.md); committed `.migration.ts` example files (e.g., a `Tenant 1.0.0 → 2.0.0` data migration paired with the existing `tenant.schema.ts` example) could be added in a dogfood pass once the schema versions actually evolve. The example surface is deliberately frozen at the v0.6 set for now to keep the regenerate-test scope tight.
- **A migration *runner / apply / executor*** — `@nekostack/schema` does **not** ship one and never will. v0.8 owns planning + verification + stub generation only; executing a migration's `transform(input)` against real data is a hard-locked non-goal of the schema package. See [`MIGRATIONS.md`](./MIGRATIONS.md) for the full non-goals table.
