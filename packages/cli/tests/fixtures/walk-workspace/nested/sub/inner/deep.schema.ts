import { s } from "@nekostack/schema";

export const Deep = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Deep")
  .version("1.0.0");
