import { s } from "@nekostack/schema";

// Used to test the "no changes" path — diffing this schema against
// itself yields an empty `changes` array and `worstSeverity: null`.
export const Stable = s
  .object({ id: s.string() })
  .id("com.fixture.walk.DiffStable")
  .version("1.0.0");
