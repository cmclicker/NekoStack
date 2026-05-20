/**
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-list.Sort.B
 * fromVersion:      1
 * toVersion:        2
 * fromIrHash:       sha256:5555555555555555555555555555555555555555555555555555555555555555
 * toIrHash:         sha256:6666666666666666666666666666666666666666666666666666666666666666
 * fromSourceHash:   sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
 * toSourceHash:     sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-list.Sort.B", "1", "2"> = {
  schemaId: "com.fixture.cli.migrate-list.Sort.B",
  from: "1",
  to: "2",
  transform(input) {
    return input;
  },
};
export default migration;
