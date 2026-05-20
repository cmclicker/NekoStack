/**
 * Provenance has a malformed `fromIrHash` (not a 64-hex sha256).
 * `parseMigrationProvenanceFromText` returns `integrity_error` +
 * `metadata.reason: "malformed_hash"`; `buildMigrationRegistry`
 * propagates it; the command exits INTEGRITY_ERROR.
 *
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-list.Integrity.BadHash
 * fromVersion:      1
 * toVersion:        2
 * fromIrHash:       sha256:not-a-real-hash
 * toIrHash:         sha256:2222222222222222222222222222222222222222222222222222222222222222
 * fromSourceHash:   sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
 * toSourceHash:     sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-list.Integrity.BadHash", "1", "2"> = {
  schemaId: "com.fixture.cli.migrate-list.Integrity.BadHash",
  from: "1",
  to: "2",
  transform(input) {
    return input;
  },
};
export default migration;
