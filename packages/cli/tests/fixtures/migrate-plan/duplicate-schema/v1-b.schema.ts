// Same (id, version) pair as v1-a.schema.ts → `buildRegistry`
// surfaces `duplicate_schema_id`; the command exits LOGICAL_FAILURE.
import { s } from "@nekostack/schema";

export const V1B = s
  .object({ a: s.string(), b: s.string() })
  .id("com.fixture.cli.migrate-plan.DupSchema")
  .version("1.0.0");
