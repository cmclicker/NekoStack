import { s } from "@nekostack/schema";

// Same schemaId + version as `two.schema.ts` in this directory.
// `buildRegistry` must surface this as a `duplicate_schema_id` Issue
// rather than silently letting one entry overwrite the other.
export const Dup = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Duplicate")
  .version("1.0.0");
