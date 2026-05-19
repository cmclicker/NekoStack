import { s } from "@nekostack/schema";

export const Top = s
  .object({ id: s.string() })
  .id("com.fixture.walk.Top")
  .version("1.0.0");
