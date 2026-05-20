import { s } from "@nekostack/schema";

export const V2 = s
  .object({ b: s.number() })
  .id("com.fixture.cli.migrate-plan.Ambiguous")
  .version("2.0.0");
