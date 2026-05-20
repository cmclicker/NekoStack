/**
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-list.Sort.A
 * fromVersion:      2
 * toVersion:        3
 * fromIrHash:       sha256:3333333333333333333333333333333333333333333333333333333333333333
 * toIrHash:         sha256:4444444444444444444444444444444444444444444444444444444444444444
 * fromSourceHash:   sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
 * toSourceHash:     sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-list.Sort.A", "2", "3"> = {
  schemaId: "com.fixture.cli.migrate-list.Sort.A",
  from: "2",
  to: "3",
  transform(input) {
    return input;
  },
};
export default migration;
