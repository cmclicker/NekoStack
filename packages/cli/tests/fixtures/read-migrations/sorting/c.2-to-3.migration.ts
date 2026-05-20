import type { Migration } from "@nekostack/schema/cli";

const migration: Migration<"com.fixture.cli.Sort", "2", "3"> = {
  schemaId: "com.fixture.cli.Sort",
  from: "2",
  to: "3",
  transform(input) {
    return input;
  },
};

export default migration;
