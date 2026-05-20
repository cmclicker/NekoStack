import { s } from "@nekostack/schema";

export const V2 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-plan.NoChange")
  .version("2.0.0");
