import { s } from "@nekostack/schema";

// Drops the `name` field over v1 — breaking change.
export const UserV3 = s
  .object({
    id: s.string(),
  })
  .id("com.fixture.walk.DiffUser")
  .version("3.0.0");
