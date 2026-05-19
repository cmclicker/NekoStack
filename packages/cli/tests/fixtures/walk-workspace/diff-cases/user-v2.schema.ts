import { s } from "@nekostack/schema";

// Adds an optional `email` field over v1 — additive change. Same
// schemaId, different version, so registry indexing keeps both.
export const UserV2 = s
  .object({
    id: s.string(),
    name: s.string(),
    email: s.string().optional(),
  })
  .id("com.fixture.walk.DiffUser")
  .version("2.0.0");
