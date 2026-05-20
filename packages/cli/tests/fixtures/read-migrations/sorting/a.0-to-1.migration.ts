import type { Migration } from "@nekostack/schema/cli";

const migration: Migration<"com.fixture.cli.Sort", "0", "1"> = {
  schemaId: "com.fixture.cli.Sort",
  from: "0",
  to: "1",
  transform(input) {
    return input;
  },
};

export default migration;
