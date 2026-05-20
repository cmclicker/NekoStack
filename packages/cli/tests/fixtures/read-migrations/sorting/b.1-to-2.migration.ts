import type { Migration } from "@nekostack/schema/cli";

const migration: Migration<"com.fixture.cli.Sort", "1", "2"> = {
  schemaId: "com.fixture.cli.Sort",
  from: "1",
  to: "2",
  transform(input) {
    return input;
  },
};

export default migration;
