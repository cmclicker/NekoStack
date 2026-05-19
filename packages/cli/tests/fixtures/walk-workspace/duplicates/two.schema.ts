import { s } from "@nekostack/schema";

// See sibling `one.schema.ts`. Same id+version is the duplicate.
export const DupTwo = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Duplicate")
  .version("1.0.0");
