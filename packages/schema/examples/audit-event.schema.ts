import { s } from "../src/index.js";

/**
 * Example: a NekoStack audit-log entry.
 *
 * The most pedagogically valuable example because it exercises every absence-
 * semantics row in one shape and is meant to be generated in `mode: "both"`
 * so the input/output split is visible side-by-side:
 *
 *  - `correlationId` is optional       → ?: in both Input + Output
 *  - `actorId` is nullable             → required key, value may be null
 *  - `severity` has a default          → ?: in Input, required in Output
 *  - `payload` uses `passthrough()`    → arbitrary extra keys allowed
 *
 * Generated artifacts live under `examples/generated/audit-event.*`.
 */
export const AuditEvent = s
  .object({
    id: s.string().uuid(),
    type: s.enum([
      "user.created",
      "user.updated",
      "user.deleted",
      "tenant.created",
      "tenant.deleted",
      "auth.login.succeeded",
      "auth.login.failed",
    ] as const),
    occurredAt: s.string(), // ISO 8601 string until s.isoDateTime() ships
    actorId: s.string().uuid().nullable(),
    tenantId: s.string().uuid(),
    targetType: s.string(),
    targetId: s.string(),
    correlationId: s.string().uuid().optional(),
    severity: s.enum(["info", "warning", "error"] as const).default("info"),
    payload: s.object({}).passthrough(),
  })
  .id("com.nekostack.audit.AuditEvent")
  .version("1.0.0")
  .describe("A single audit log entry recording a notable action.");
