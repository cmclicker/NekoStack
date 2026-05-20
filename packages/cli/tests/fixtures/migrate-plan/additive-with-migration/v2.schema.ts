import { s } from "@nekostack/schema";

export const V2 = s
  .object({ a: s.string(), b: s.string().optional() })
  .id("com.fixture.cli.migrate-plan.AdditiveWithMig")
  .version("2.0.0");
