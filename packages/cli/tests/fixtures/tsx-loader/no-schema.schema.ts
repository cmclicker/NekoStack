// Module evaluates fine but exposes zero Schema instances. The loader
// should classify this as `no_schema_export`.

export const NOT_A_SCHEMA = { hello: "world" };
export function alsoNotASchema(): number {
  return 42;
}
