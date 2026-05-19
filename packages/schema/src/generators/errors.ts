/**
 * Stable, machine-readable error thrown when a generator encounters IR it
 * cannot represent — either an unsupported node kind or a refinement whose
 * absence would change validation behavior (per Invariant 7).
 *
 * Tests assert on `code` / `kind` / `generator` — never on `message`, which
 * is for humans and can change without breaking the contract.
 *
 * Current `kind` values:
 *   - IR node kinds without generator support: `date`, `union`,
 *     `recursiveRef`, `transform`.
 *   - Refinement-level: `runtimeRefinement` (all generators);
 *     `regexFlags` (JSON Schema / OpenAPI — `pattern` has no flag support).
 *
 * Current `generator` values: `typescript`, `zod`, `jsonSchema`, `openApi`.
 * Both unions extend over time as new generators or new throw cases land;
 * see the active generator docs in `packages/schema/docs/` for the
 * authoritative per-generator throw contract.
 */
export class UnsupportedNodeKindError extends Error {
  readonly code = "UNSUPPORTED_NODE_KIND" as const;
  readonly kind: string;
  readonly generator: "typescript" | "zod" | "jsonSchema" | "openApi" | "diff";

  constructor(args: {
    kind: string;
    generator: "typescript" | "zod" | "jsonSchema" | "openApi" | "diff";
  }) {
    super(
      `Generator '${args.generator}' does not support IR node kind '${args.kind}' in this phase. ` +
        `See packages/schema/docs/ for the active generator contracts.`,
    );
    this.name = "UnsupportedNodeKindError";
    this.kind = args.kind;
    this.generator = args.generator;
  }
}
