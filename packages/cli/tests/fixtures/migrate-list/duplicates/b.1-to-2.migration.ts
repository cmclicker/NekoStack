/**
 * Claims the same `(schemaId, fromVersion, toVersion)` triple as
 * `a.1-to-2.migration.ts`. `buildMigrationRegistry` surfaces a
 * `duplicate_migration` issue; `runMigrateList` exits LOGICAL_FAILURE.
 *
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-list.Dup
 * fromVersion:      1
 * toVersion:        2
 * fromIrHash:       sha256:1111111111111111111111111111111111111111111111111111111111111111
 * toIrHash:         sha256:2222222222222222222222222222222222222222222222222222222222222222
 * fromSourceHash:   sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
 * toSourceHash:     sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-list.Dup", "1", "2"> = {
  schemaId: "com.fixture.cli.migrate-list.Dup",
  from: "1",
  to: "2",
  transform(input) {
    return input;
  },
};
export default migration;
