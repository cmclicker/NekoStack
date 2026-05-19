import { s } from "@nekostack/schema";

export const Tenant = s
  .object({ id: s.string() })
  .id("com.fixture.tsx-loader.Tenant")
  .version("1.0.0");

export const Account = s
  .object({ id: s.string(), tenantId: s.string() })
  .id("com.fixture.tsx-loader.Account")
  .version("1.0.0");
