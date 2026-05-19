import { s } from "@nekostack/schema";

export const User = s
  .object({
    id: s.string(),
    name: s.string(),
  })
  .id("com.fixture.tsx-loader.User")
  .version("1.0.0");
