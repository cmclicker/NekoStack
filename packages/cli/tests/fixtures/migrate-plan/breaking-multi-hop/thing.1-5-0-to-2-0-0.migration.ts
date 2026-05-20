/**
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-plan.MultiHop
 * fromVersion:      1.5.0
 * toVersion:        2.0.0
 * fromIrHash:       sha256:5555555555555555555555555555555555555555555555555555555555555555
 * toIrHash:         sha256:2222222222222222222222222222222222222222222222222222222222222222
 * fromSourceHash:   sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
 * toSourceHash:     sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-plan.MultiHop", "1.5.0", "2.0.0"> = {
  schemaId: "com.fixture.cli.migrate-plan.MultiHop",
  from: "1.5.0",
  to: "2.0.0",
  transform(input) {
    return { value: (input as { a: number }).a };
  },
};
export default migration;
