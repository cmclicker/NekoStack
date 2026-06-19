# NekoStack — Product Thesis

> The doctrine that decides whether a phase belongs in NekoStack. Read **before** writing a phase plan, before adding a package, and before justifying a dependency on an external library.

This document is the fifth governing doc. The other four say *where* things go ([`BOUNDARIES.md`](BOUNDARIES.md)), *what kind* of thing they are ([`ARTIFACTS.md`](ARTIFACTS.md)), *in what order* they get built ([`DEPENDENCY-GRAPH.md`](DEPENDENCY-GRAPH.md), [`ROADMAP.md`](ROADMAP.md)), and *how* a single package gets accepted ([`standards/package-development.md`](standards/package-development.md)). This one says *why* — and therefore which phases are in scope at all.

---

## The thesis

**NekoStack is a workflow-replacement stack, not an adapter collection.**

Every package absorbs a workflow that the user currently does by stitching external tools together. The user-facing surface is `neko *` commands and `@nekostack/*` imports — not "thin wrappers around Zod / Ajv / Redocly / Auth.js." External tools may live inside a package as an internal engine, but they must not surface as the user's primary verb.

## The internal-engine rule

External libraries are permitted **inside** a package when they are the right engine for the job and the cost of reimplementing is unjustified. They are not permitted as the *surface*.

| Allowed | Not allowed |
|---|---|
| `@nekostack/schema` uses Zod internally to execute generated validators. | "Use Zod, but import it from `@nekostack/schema`." |
| `@nekostack/schema` uses Ajv internally for self-conformance tests. | "Generate a JSON Schema; pipe it to Ajv yourself." |
| `@nekostack/schema` uses Redocly internally for OpenAPI round-trip tests. | "Emit an OpenAPI component; validate it with Redocly yourself." |
| `@nekostack/auth` adapts Auth.js / Clerk / Supabase providers behind a single `AuthContext`. | "Pick a provider; here's a thin re-export." |
| `@nekostack/email` calls Resend's SDK from inside the send pipeline. | "Here's Resend; you wire the templates / bounces / retries yourself." |

The dividing line: **does the user have to know which external tool is underneath to use the package correctly?** If yes, the package is leaking the tool — the wrapper isn't load-bearing. If no, the package has absorbed the workflow and the user is free of that detail.

This applies to documentation too. A package's `USAGE.md` describes `neko *` commands and `@nekostack/*` imports. If it teaches the user to install or import the underlying tool, the package hasn't done its job.

## The four questions

Every phase plan answers these before merging. A plan that cannot answer all four is not yet a plan.

1. **Which workflow does this phase absorb?**
   Name the manual / cross-tool stitching the user currently does. "Add runtime validation" is not a workflow; "stop having to import Zod and translate its errors into a uniform issue vocabulary in every project" is.

2. **What is the user-facing verb?**
   A `neko *` subcommand, an `@nekostack/<package>` import, or both. If the answer is "use external tool X," the phase is not in scope — it is documentation, not capability.

3. **What is the internal engine, and is it justified?**
   Name the libraries the phase consumes. Each must be either (a) unsafe to reimplement (crypto, OAuth, parsing complex formats) or (b) clearly the right tool with no maintenance cost the package wouldn't otherwise carry. If reaching for an external engine because "it's faster than building one," that is a smell — re-justify or build.

4. **Which BOUNDARIES rows does this phase touch?**
   List the capability rows the phase implements, supplies inputs to, or consumes outputs from. Cross-package dependencies must already be declared in [`BOUNDARIES.md`](BOUNDARIES.md); if a needed edge is missing, edit BOUNDARIES first.

A phase that fails question 1 is a refactor, not a phase. A phase that fails question 2 is a recommendation, not a package. A phase that fails question 3 is leaking. A phase that fails question 4 is unbounded.

## Packages are capability boundaries, not npm libraries

The ~107 entries in [`BOUNDARIES.md`](BOUNDARIES.md) are a **capability map**, not a publish manifest. Each package name marks "this is the place where this capability lives" — it is a boundary for ownership, not a commitment to ship 107 standalone libraries to npm.

Consequences:

- **A package can fold capabilities** if they share a boundary and a contract — see the `audit` / `log` / `telemetry` / `trace` / `events` clarification in BOUNDARIES.md §22 / Conflict resolution.
- **A package can ship as part of a larger bundle**; whether it has its own npm entry is a separate decision from whether it exists as a boundary.
- **The cost of a package is the workflow it absorbs, not the lines of code it contains.** A tiny package that takes a real cross-tool stitching burden off the user is doing its job; a large package that just re-exports a vendor library is not.

This is why "107 packages" is not the same as "107 npm libraries." It is the answer to: *for every workflow the stack handles, where does the ownership sit?*

## Phase framing implications

Each phase plan PR includes a **Thesis-fit** section answering the four questions above. The implementation-acceptance audit reads it; "the four questions" become an explicit gate alongside the existing scope / contract / boundary audits in [`standards/package-development.md`](standards/package-development.md).

In particular:

- A phase whose answer to question 2 is *"install Zod and use it"* is rejected — runtime validation has to come out of `@nekostack/schema`'s surface. The user choosing to import Zod directly is fine; the *recommended workflow* must be NekoStack-native.
- A phase whose answer to question 2 is *"run the Ajv CLI"* is rejected — the workflow has to come out of `neko *`. Ajv stays as the internal engine if it's the right engine; the CLI verb belongs to NekoStack.
- A phase whose answer to question 3 is *"none — we built it from scratch because we wanted to"* against an unsafe substrate (e.g., OAuth, cryptographic primitives) is rejected — see the exclusions in the README "What this is not" section.

## What this thesis is not

- **It is not anti-dependency.** External libraries are encouraged when they are the right engine. The objection is to leaking them as the user's surface.
- **It is not a publish strategy.** Whether a given package has its own npm entry is decided per-package, not by this doc.
- **It is not the same as the scope audit.** Scope audits ask "did this phase ship what its plan said?" The thesis asks "should the phase have existed in this shape at all?" Both questions matter; they catch different failures.
- **It is not retroactive license to break invariants.** Future phases still respect the per-package contracts in `packages/*/docs/INVARIANTS.md`. If a phase needs to violate one, raise it explicitly — the thesis doesn't override invariants, it clarifies which phases belong.

## See also

- [`BOUNDARIES.md`](BOUNDARIES.md) — capability ownership map (the *where*).
- [`ARTIFACTS.md`](ARTIFACTS.md) — reusable-asset taxonomy (the *what kind*).
- [`DEPENDENCY-GRAPH.md`](DEPENDENCY-GRAPH.md) — build-order DAG (the *in what order*).
- [`ROADMAP.md`](ROADMAP.md) — phased multi-year plan (the *when*).
- [`standards/package-development.md`](standards/package-development.md) — per-package acceptance discipline (the *how*).
- [`README.md`](README.md) — entry point.
