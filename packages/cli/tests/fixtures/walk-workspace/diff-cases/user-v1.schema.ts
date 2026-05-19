import { s } from "@nekostack/schema";

// Baseline. v2 is additive over this; v3 is breaking over this.
export const UserV1 = s
  .object({
    id: s.string(),
    name: s.string(),
  })
  .id("com.fixture.walk.DiffUser")
  .version("1.0.0");
