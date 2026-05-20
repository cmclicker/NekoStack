import { s } from "@nekostack/schema";

export const V1A = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-plan.DupSchema")
  .version("1.0.0");
