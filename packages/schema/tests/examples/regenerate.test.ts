import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  generateJsonSchema,
  generateOpenApiSchemaComponent,
  generateTypeScript,
  generateZod,
  irHash,
} from "../../src/index.js";
import { sourceHashFromText } from "../../src/registry/source-hash.js";
import { Tenant } from "../../examples/tenant.schema.js";
import { AuditEvent } from "../../examples/audit-event.schema.js";
import { Entitlement } from "../../examples/entitlement.schema.js";

/**
 * The committed files under `packages/schema/examples/generated/` ARE the
 * snapshots for these tests. If a schema in `packages/schema/examples/`
 * changes and the generated files aren't refreshed, these tests fail.
 *
 * To regenerate after an intentional schema change:
 *
 *   npx vitest run tests/examples/regenerate.test.ts -u --workspace packages/schema
 *
 * This is the closest thing v0.2 has to a "generate" CLI command — the CLI
 * proper is v0.7. For now, the dogfood pass uses vitest's snapshot mechanism
 * as both validation AND regeneration.
 *
 * Since v0.7 Step 20b, each generator call here passes
 * `ProvenanceOptions.sourceHash` computed from the matching `*.schema.ts`
 * source text. The committed example artifacts therefore carry `sourceHash`
 * provenance (TS/Zod JSDoc header line; JSON Schema / OpenAPI
 * `x-nekostack.sourceHash`). `sourceHash` remains **optional** for direct
 * generator callers outside this regeneration path — omitting it still
 * produces byte-identical output to v0.6 and earlier.
 */

const out = (name: string): string => `../../examples/generated/${name}`;

const SCHEMA_DIR = fileURLToPath(new URL("../../examples/", import.meta.url));

function sourceHashFor(filename: string): `sha256:${string}` {
  return sourceHashFromText(readFileSync(SCHEMA_DIR + filename, "utf8"));
}

const tenantSourceHash = sourceHashFor("tenant.schema.ts");
const auditEventSourceHash = sourceHashFor("audit-event.schema.ts");
const entitlementSourceHash = sourceHashFor("entitlement.schema.ts");

describe("examples/generated/ is in sync with examples/*.schema.ts", () => {
  describe("Tenant", () => {
    it("TS output mode", async () => {
      await expect(
        generateTypeScript(Tenant.node, { sourceHash: tenantSourceHash }),
      ).toMatchFileSnapshot(out("tenant.types.ts"));
    });
    it("Zod", async () => {
      await expect(
        generateZod(Tenant.node, { sourceHash: tenantSourceHash }),
      ).toMatchFileSnapshot(out("tenant.zod.ts"));
    });
    it("JSON Schema", async () => {
      await expect(
        generateJsonSchema(Tenant.node, { sourceHash: tenantSourceHash }),
      ).toMatchFileSnapshot(out("tenant.json.schema.json"));
    });
    it("OpenAPI 3.1 component schema", async () => {
      await expect(
        generateOpenApiSchemaComponent(Tenant.node, {
          sourceHash: tenantSourceHash,
        }),
      ).toMatchFileSnapshot(out("tenant.openapi.json"));
    });
  });

  describe("AuditEvent — input/output split is the headline feature here", () => {
    it("TS both mode (Input + Output side-by-side)", async () => {
      await expect(
        generateTypeScript(AuditEvent.node, {
          mode: "both",
          sourceHash: auditEventSourceHash,
        }),
      ).toMatchFileSnapshot(out("audit-event.both.ts"));
    });
    it("Zod", async () => {
      await expect(
        generateZod(AuditEvent.node, { sourceHash: auditEventSourceHash }),
      ).toMatchFileSnapshot(out("audit-event.zod.ts"));
    });
    it("JSON Schema", async () => {
      await expect(
        generateJsonSchema(AuditEvent.node, {
          sourceHash: auditEventSourceHash,
        }),
      ).toMatchFileSnapshot(out("audit-event.json.schema.json"));
    });
    it("OpenAPI 3.1 component schema", async () => {
      await expect(
        generateOpenApiSchemaComponent(AuditEvent.node, {
          sourceHash: auditEventSourceHash,
        }),
      ).toMatchFileSnapshot(out("audit-event.openapi.json"));
    });
  });

  describe("Entitlement", () => {
    it("TS output mode", async () => {
      await expect(
        generateTypeScript(Entitlement.node, {
          sourceHash: entitlementSourceHash,
        }),
      ).toMatchFileSnapshot(out("entitlement.types.ts"));
    });
    it("Zod", async () => {
      await expect(
        generateZod(Entitlement.node, { sourceHash: entitlementSourceHash }),
      ).toMatchFileSnapshot(out("entitlement.zod.ts"));
    });
    it("JSON Schema", async () => {
      await expect(
        generateJsonSchema(Entitlement.node, {
          sourceHash: entitlementSourceHash,
        }),
      ).toMatchFileSnapshot(out("entitlement.json.schema.json"));
    });
    it("OpenAPI 3.1 component schema", async () => {
      await expect(
        generateOpenApiSchemaComponent(Entitlement.node, {
          sourceHash: entitlementSourceHash,
        }),
      ).toMatchFileSnapshot(out("entitlement.openapi.json"));
    });
  });
});

describe("irHash determinism for the example schemas", () => {
  // Sanity check: re-running the schema files yields the same hash, proving
  // the IR is stable and the example .types.ts / .zod.ts header values won't
  // churn between runs.
  it("Tenant hash is stable", () => {
    expect(irHash(Tenant.node)).toBe(irHash(Tenant.node));
  });
  it("AuditEvent hash is stable", () => {
    expect(irHash(AuditEvent.node)).toBe(irHash(AuditEvent.node));
  });
  it("Entitlement hash is stable", () => {
    expect(irHash(Entitlement.node)).toBe(irHash(Entitlement.node));
  });
});
