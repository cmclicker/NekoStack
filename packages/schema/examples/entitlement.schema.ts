import { s } from "../src/index.js";

/**
 * Example: a feature entitlement granted to a tenant.
 *
 * Exercises:
 *  - Boolean with default
 *  - Number with `int` + `min` + `nullable` (null = unlimited)
 *  - Array of strings with `max` items
 *  - `.deprecated()` metadata flag on a field-level schema
 *  - Mixed required + optional fields in one object
 */
export const Entitlement = s
  .object({
    id: s.string().uuid(),
    tenantId: s.string().uuid(),
    feature: s.string().regex(/^[a-z][a-z0-9_.]+$/),
    enabled: s.boolean().default(true),
    quota: s.number().int().min(0).nullable(),
    expiresAt: s.string().nullable(),
    tags: s.array(s.string()).max(20),
    legacyTier: s.string().optional().deprecated(),
  })
  .id("com.nekostack.entitlements.Entitlement")
  .version("1.0.0")
  .describe("A single feature entitlement granted to a tenant.");
