import { s } from "@nekostack/schema";

export const V15 = s
  .object({ a: s.number() })
  .id("com.fixture.cli.migrate-plan.Ambiguous")
  .version("1.5.0");
