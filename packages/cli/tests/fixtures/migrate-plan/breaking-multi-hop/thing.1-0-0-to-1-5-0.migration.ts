/**
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-plan.MultiHop
 * fromVersion:      1.0.0
 * toVersion:        1.5.0
 * fromIrHash:       sha256:1111111111111111111111111111111111111111111111111111111111111111
 * toIrHash:         sha256:5555555555555555555555555555555555555555555555555555555555555555
 * fromSourceHash:   sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
 * toSourceHash:     sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-plan.MultiHop", "1.0.0", "1.5.0"> = {
  schemaId: "com.fixture.cli.migrate-plan.MultiHop",
  from: "1.0.0",
  to: "1.5.0",
  transform(input) {
    return { a: Number((input as { a: string }).a) };
  },
};
export default migration;
