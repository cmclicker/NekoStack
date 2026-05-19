import { s } from "@nekostack/schema";

export const Alpha = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Alpha")
  .version("1.0.0");
