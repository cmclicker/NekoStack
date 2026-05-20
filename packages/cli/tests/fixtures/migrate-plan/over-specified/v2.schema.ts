import { s } from "@nekostack/schema";

export const V2 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-plan.OverSpecified")
  .version("2.0.0");
