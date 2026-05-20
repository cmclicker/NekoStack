// Deliberately broken syntax — tsx/esbuild refuses to transform.
// The loader classifies this as `compile_error`.

export default {
  schemaId: "com.fixture.cli.Failures.CompileError",
  from: "1",
  to: "2",
  transform(input)
    /* missing arrow / function body — unparseable */ {
    return input
  ,
}
