import type { Migration } from "@nekostack/schema/cli";

const migration: Migration<"com.fixture.cli.Nested.Deep", "1", "2"> = {
  schemaId: "com.fixture.cli.Nested.Deep",
  from: "1",
  to: "2",
  transform(input) {
    return input;
  },
};

export default migration;
