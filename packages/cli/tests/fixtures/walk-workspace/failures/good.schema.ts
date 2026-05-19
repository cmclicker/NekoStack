import { s } from "@nekostack/schema";

export const Good = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Good")
  .version("1.0.0");
