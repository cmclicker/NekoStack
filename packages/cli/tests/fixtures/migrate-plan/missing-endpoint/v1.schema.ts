// Only v1 exists. Tests request v2 (not in the registry) and expect
// `migration_missing_endpoint` → LOGICAL_FAILURE.
import { s } from "@nekostack/schema";

export const V1 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-plan.MissingEndpoint")
  .version("1.0.0");
