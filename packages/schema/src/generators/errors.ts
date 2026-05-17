/**
 * Stable, machine-readable error thrown when a generator encounters an IR
 * node kind it cannot represent.
 *
 * Tests assert on `code` / `kind` / `generator` — never on `message`, which
 * is for humans and can change without breaking the contract.
 *
 * v0.2 generators throw this for: `date`, `union`, `recursiveRef`,
 * `transform`, and any runtime-only refinement encountered while walking IR.
 */
export class UnsupportedNodeKindError extends Error {
  readonly code = "UNSUPPORTED_NODE_KIND" as const;
  readonly kind: string;
  readonly generator: "typescript" | "zod" | "jsonSchema" | "openApi";

  constructor(args: { kind: string; generator: "typescript" | "zod" | "jsonSchema" | "openApi" }) {
    super(
      `Generator '${args.generator}' does not support IR node kind '${args.kind}' in this phase. ` +
        `See packages/schema/docs/ for the active generator contracts.`,
    );
    this.name = "UnsupportedNodeKindError";
    this.kind = args.kind;
    this.generator = args.generator;
  }
}
