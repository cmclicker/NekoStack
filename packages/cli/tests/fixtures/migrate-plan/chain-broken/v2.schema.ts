import { s } from "@nekostack/schema";

export const V2 = s
  .object({ a: s.number() })
  .id("com.fixture.cli.migrate-plan.ChainBroken")
  .version("2.0.0");
