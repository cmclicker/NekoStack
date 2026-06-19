import { defineConfig } from "nekostack";

export default defineConfig({
  projectId: "{{project.id}}",
  type: "web:standard",
  version: "1.0.0",
  // The CLI uses these paths to discover where your source-of-truth schemas live.
  schemaDirs: [
    "./schemas",
    "./theme"
  ],
  // Artifacts are generated alongside the source, but we centralize
  // the configuration rules here.
  generators: {
    typescript: true,
    zod: true,
    jsonSchema: true,
    openApi: true
  }
});
