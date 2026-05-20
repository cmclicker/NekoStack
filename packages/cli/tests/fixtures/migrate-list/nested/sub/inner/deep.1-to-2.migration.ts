/**
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-list.Nested.Deep
 * fromVersion:      1
 * toVersion:        2
 * fromIrHash:       sha256:3333333333333333333333333333333333333333333333333333333333333333
 * toIrHash:         sha256:4444444444444444444444444444444444444444444444444444444444444444
 * fromSourceHash:   sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
 * toSourceHash:     sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-list.Nested.Deep", "1", "2"> = {
  schemaId: "com.fixture.cli.migrate-list.Nested.Deep",
  from: "1",
  to: "2",
  transform(input) {
    return input;
  },
};
export default migration;
