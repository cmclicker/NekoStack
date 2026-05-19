import { s } from "@nekostack/schema";

export const DefaultNamed = s
  .object({ id: s.string() })
  .id("com.fixture.walk.DefaultNamed")
  .version("1.0.0");
