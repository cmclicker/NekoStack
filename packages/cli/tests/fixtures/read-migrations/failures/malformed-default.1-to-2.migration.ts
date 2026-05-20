// Default export is an object but missing the required `transform`
// function. The loader's structural check fails → `no_migration_export`.

export default {
  schemaId: "com.fixture.cli.Failures.Malformed",
  from: "1",
  to: "2",
  // transform deliberately absent
};
