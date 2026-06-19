# Issue Codes Catalog

> Canonical list of stable, machine-readable issue codes emitted by the `@nekostack/schema` runtime. Every validation failure maps to one of these codes.

## Overview

Unlike raw validation libraries that leak internal error types, `@nekostack/schema` normalizes all issues into a stable vocabulary. This ensures that downstream consumers (UI forms, API responders, audit loggers) can reason about failures without coupling to the underlying execution engine (Zod).

Each `Issue` follows this shape:

```ts
type Issue = {
  code: IssueCode;               // Stable machine-readable string
  path: Array<string | number>;  // JSON path to the offending field
  message: string;               // Human-readable description (English by default)
  expected?: unknown;            // Optional: what the validator wanted
  received?: unknown;            // Optional: what the input actually provided
  schemaId?: string;             // Optional: reverse-DNS schema identity
  schemaVersion?: string;        // Optional: schema version
  severity: "error" | "warning"; // Always "error" in v0.6+
  metadata?: Record<string, any>;// Additional context (e.g. min/max values)
};
```

---

## Core Codes

### `missing_required`
- **When:** A required field is absent from the input object or is `undefined`.
- **Precedence:** This code "wins" over `invalid_type` when a field is missing.
- **Notes:** In NekoStack, `null` is a value, while `undefined` is absence.

### `invalid_type`
- **When:** The input value exists but its primitive type (string, number, boolean) does not match the schema.
- **Expected/Received:** Populated with the expected and received types (e.g., `expected: "number"`, `received: "string"`).

### `unknown_key`
- **When:** An object schema is `strict` (default) and the input contains keys not defined in the shape.
- **Metadata:** One issue is emitted per offending key.

### `invalid_literal`
- **When:** The value does not exactly match a constant literal defined via `s.literal(v)`.
- **Expected/Received:** Populated with the literal values.

### `invalid_enum`
- **When:** The value is not a member of the allowed set defined via `s.enum([...])`.
- **Expected:** Contains the full array of allowed enum members.

### `invalid_union`
- **When:** None of the branches in a `s.union` or `s.discriminatedUnion` match the input.
- **Reporting:** Returns issues from the "best-matching" branch (the one that progressed furthest).

---

## Constraint Codes (Refinements)

### `too_small`
- **When:** A number is below `min()`, a string is shorter than `min()`, or an array has fewer than `minItems()`.
- **Metadata:**
  - `minimum`: the threshold value.
  - `inclusive`: boolean (true for `min`, false for `gt`).
  - `type`: `"number"`, `"string"`, or `"array"`.

### `too_big`
- **When:** A number is above `max()`, a string is longer than `max()`, or an array has more than `maxItems()`.
- **Metadata:**
  - `maximum`: the threshold value.
  - `inclusive`: boolean (true for `max`, false for `lt`).
  - `type`: `"number"`, `"string"`, or `"array"`.

### `invalid_format`
- **When:** A string fails a portable format check like `email()`, `uuid()`, `url()`, or `regex()`.
- **Metadata:**
  - `validation`: `"email"`, `"uuid"`, `"url"`, or `"regex"`.

---

## Advanced / Internal Codes

### `custom_refinement_failed`
- **When:** A runtime-only custom predicate (`s.refine()`) returns false.
- **Metadata:** May carry engine-specific context if the refinement was leaked from an underlying provider.

### `schema_version_unsupported`
- **When:** The registry finds a schema with the requested ID but the version is incompatible with the requested operation.

### `recursive_reference_unresolved`
- **When:** A `s.lazy()` reference cannot be resolved during compilation or execution (e.g. a missing ID in the registry).

---

## Fallback Contract

If the underlying engine (Zod) emits a code that NekoStack does not yet recognize, the normalizer maps it to **`custom_refinement_failed`** and populates:
- `metadata.source = "zod"`
- `metadata.zodCode = <original_code>`

This ensures that future engine updates do not break the NekoStack contract.
