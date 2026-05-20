/**
 * Migration goes v1 → v3, but the planner is asked for v1 → v2.
 * v3 isn't an endpoint, and there are no outgoing edges from v3.
 * `enumerateChains` returns 0 chains → `migration_chain_broken`.
 *
 * @migration by @nekostack/schema
 * schemaId:         com.fixture.cli.migrate-plan.ChainBroken
 * fromVersion:      1.0.0
 * toVersion:        3.0.0
 * fromIrHash:       sha256:1111111111111111111111111111111111111111111111111111111111111111
 * toIrHash:         sha256:3333333333333333333333333333333333333333333333333333333333333333
 * fromSourceHash:   sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
 * toSourceHash:     sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"com.fixture.cli.migrate-plan.ChainBroken", "1.0.0", "3.0.0"> = {
  schemaId: "com.fixture.cli.migrate-plan.ChainBroken",
  from: "1.0.0",
  to: "3.0.0",
  transform(input) {
    return input;
  },
};
export default migration;
