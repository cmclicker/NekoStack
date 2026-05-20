import type { Migration } from "@nekostack/schema/cli";

const migration: Migration<
  "com.fixture.cli.Sample",
  "1.0.0",
  "2.0.0",
  { v: number },
  { v: number }
> = {
  schemaId: "com.fixture.cli.Sample",
  from: "1.0.0",
  to: "2.0.0",
  transform(input) {
    return input;
  },
};

export default migration;
