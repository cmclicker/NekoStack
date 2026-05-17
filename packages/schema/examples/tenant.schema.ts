import { s } from "../src/index.js";

/**
 * Example: a NekoStack workspace tenant.
 *
 * Exercises:
 *  - `.uuid()` portable refinement
 *  - String regex with constraint chain (`min` / `max` / `regex`)
 *  - Enum with default
 *  - Nullable field (`billingEmail` — required key, value may be null)
 *  - Nested object with optional + required fields
 *  - Schema metadata (`id`, `version`, `describe`)
 */
export const Tenant = s
  .object({
    id: s.string().uuid(),
    slug: s
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9-]+$/),
    name: s.string().min(1).max(120),
    plan: s.enum(["free", "pro", "enterprise"] as const).default("free"),
    billingEmail: s.string().email().nullable(),
    metadata: s.object({
      createdBy: s.string().uuid(),
      notes: s.string().optional(),
    }),
  })
  .id("com.nekostack.tenant.Tenant")
  .version("1.0.0")
  .describe("A NekoStack workspace tenant.");
