import { s } from "@nekostack/schema";

// Single source file declaring two named schemas — Master plan
// Decision #6 explicitly supports this for artifact generation
// (with a discriminator slug). `schema diff` has no such per-schema
// disambiguator on its operands, so a file-path operand pointing
// here must be rejected as ambiguous.

export const First = s
  .object({ id: s.string() })
  .id("com.fixture.walk.DiffMultiA")
  .version("1.0.0");

export const Second = s
  .object({ id: s.string(), name: s.string() })
  .id("com.fixture.walk.DiffMultiB")
  .version("1.0.0");
