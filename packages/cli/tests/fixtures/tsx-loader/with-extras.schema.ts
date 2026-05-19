import { s } from "@nekostack/schema";

// One Schema plus non-Schema exports — helpers, constants, a type. The
// loader should pick up only `Profile` and silently ignore the rest.

export const Profile = s
  .object({ handle: s.string() })
  .id("com.fixture.tsx-loader.Profile")
  .version("1.0.0");

export const DEFAULT_HANDLE = "anon";

export function buildHandle(prefix: string): string {
  return `${prefix}-${DEFAULT_HANDLE}`;
}

export type ProfileShape = { handle: string };
