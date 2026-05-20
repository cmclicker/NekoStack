import { s } from "@nekostack/schema";

export const V2 = s
  .object({ value: s.number() })
  .id("com.fixture.cli.migrate-plan.MultiHop")
  .version("2.0.0");
