import { s } from "@nekostack/schema";

export const Beta = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Beta")
  .version("1.0.0");
