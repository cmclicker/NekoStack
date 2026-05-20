/**
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-plan.BreakingExact
 * fromVersion:      1.0.0
 * toVersion:        2.0.0
 * fromIrHash:       sha256:1111111111111111111111111111111111111111111111111111111111111111
 * toIrHash:         sha256:2222222222222222222222222222222222222222222222222222222222222222
 * fromSourceHash:   sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
 * toSourceHash:     sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-plan.BreakingExact", "1.0.0", "2.0.0"> = {
  schemaId: "com.fixture.cli.migrate-plan.BreakingExact",
  from: "1.0.0",
  to: "2.0.0",
  transform(input) {
    return { a: Number((input as { a: string }).a) };
  },
};
export default migration;
