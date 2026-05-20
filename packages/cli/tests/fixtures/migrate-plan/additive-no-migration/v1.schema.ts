import { s } from "@nekostack/schema";

export const V1 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-plan.AdditiveNoMig")
  .version("1.0.0");
