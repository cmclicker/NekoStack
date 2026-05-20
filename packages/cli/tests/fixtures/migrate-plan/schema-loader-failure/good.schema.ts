import { s } from "@nekostack/schema";

export const Good = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-plan.SchemaLoaderFailure")
  .version("1.0.0");
