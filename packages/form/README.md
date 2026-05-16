# @nekostack/form

> Declarative form schema + state + validation + UX. Drives forms from `@nekostack/schema` definitions. The "30% of every web app" layer that nobody gets quite right.

## Why this exists

Forms are the most universal piece of UI. They are also the most universally-mishandled. Every project re-invents:

- The validation timing rules (validate on change? on blur? on submit?).
- Error message presentation.
- The "loading / dirty / pristine / submitting / submitted / failed" state machine.
- Async validation coordination (e.g., username-uniqueness check).
- Controlled-vs-uncontrolled input wiring.
- Multi-step form orchestration.
- Conditional field visibility ("show country, then state, only after country is selected").

The libraries (React Hook Form, Formik, TanStack Form) cover the state-management piece well, but they leave you to:
1. Define your validation schema separately from your form definition.
2. Build the UI primitives (`<TextField>`, `<Select>`, etc.) that wire into the state.
3. Author your own error display.
4. Handle the i18n of your error messages.
5. Make controlled-vs-uncontrolled decisions per field.

`@nekostack/form` is the layer above. You define a form schema (typically just *reusing* a `@nekostack/schema` schema). The library produces the state machine, the validation pipeline, the field-binding helpers, and the integration with `@nekostack/ui`'s form primitives. Errors map to the schema's structured error shape automatically.

Building this yourself rather than adopting React Hook Form + Zod resolver is justified because:
1. **Schema-driven, not glue-driven.** RHF + Zod requires connecting two systems. Our form *is* the schema.
2. **Async validation is first-class.** Username uniqueness, server-side checks, debounced field-level async — not bolted on.
3. **Multi-step orchestration.** Wizards, branching flows, conditional fields — declared at the schema layer.
4. **UI integration is direct.** Form bindings produce props that `@nekostack/ui` components consume natively.

## Scope

### In scope
- Form definition: built on top of `@nekostack/schema`.
- State machine: pristine / dirty / touched / submitting / submitted / failed.
- Validation: sync (schema-driven), async (debounced field checks).
- Field bindings: produces props for inputs.
- Error display: structured errors mapped to fields.
- Multi-step / wizard forms with branching.
- Conditional fields (show/hide based on other fields).
- Field arrays (repeatable groups).
- React hooks + framework adapters (Solid, Vue if needed later).
- Submission orchestration with optimistic updates.

### Out of scope
- The visual components themselves. Those live in `@nekostack/ui`.
- The validation primitives. Those come from `@nekostack/schema`.
- Server-side form-action endpoints. Use `@nekostack/api`.
- Drag-and-drop form builders (the editor UI for non-developers). Could be a future product.

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **React Hook Form** | Excellent perf, mature, popular. | Schema is separate (Zod resolver). UI bindings are manual. |
| **Formik** | Mature, well-known. | Performance issues at scale, less active development. |
| **TanStack Form** | Modern, framework-agnostic, types-first. | Closest to what we want. Schema integration is still glue. |
| **react-final-form** | Subscription-based, performant. | Less active, smaller ecosystem. |
| **Mantine Form** | Tightly integrated with Mantine UI. | Mantine-coupled. |
| **vee-validate** (Vue) | Vue-specific. | Wrong framework. |
| **conform (Remix)** | Server-action-first form library. | Remix-coupled, server-action shape. |
| **uniforms** | Schema-driven (JSON Schema, GraphQL, etc.). | Auto-rendered UI; less control than we want. Inspirational shape. |

The right framing: **TanStack Form's API + uniforms' schema-driven philosophy + tight `@nekostack/schema` / `@nekostack/ui` integration.** We are not competing with React Hook Form; we are building one level higher.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — form schemas use the same DSL.
- `@nekostack/ui` — field bindings produce props for UI components.

**Used by:**
- Every form in every consuming project. Profile edit forms, settings, content authoring, agent prompt editors, retail-ops data entry, narrative metadata, puzzle authoring, admin dashboards — all of it.

## Design philosophy

- **Schema is the source.** A form's shape, validation rules, defaults, and error messages all derive from a single schema.
- **State is observable.** Components can subscribe to specific field state without re-rendering the whole form.
- **Async validation is first-class.** Debounced per-field async checks with proper cancellation.
- **Conditional logic is declarative.** "Show this field when X is Y" lives in the schema, not in JSX.
- **Wizards are forms with steps.** A multi-step flow is a single form with a step machine layered on top.
- **Errors are typed.** A field's error is structured (code + path + message + meta), not a string.

## Architecture sketch

```
packages/form/
├── src/
│   ├── core/
│   │   ├── form.ts           # createForm()
│   │   ├── state.ts          # form state machine
│   │   ├── field.ts          # field state + bindings
│   │   └── validator.ts      # schema-driven + async
│   ├── react/
│   │   ├── useForm.ts
│   │   ├── useField.ts
│   │   ├── Field.tsx         # binding helper component
│   │   └── FormProvider.tsx
│   ├── conditional/
│   │   ├── when.ts           # show-when conditions
│   │   └── compute.ts        # reactive computed fields
│   ├── wizard/
│   │   ├── step.ts
│   │   └── branch.ts         # conditional step routing
│   ├── array/
│   │   └── field-array.ts
│   ├── submit/
│   │   └── optimistic.ts
│   └── errors/
│       └── map.ts            # schema errors → field errors
├── tests/
└── README.md
```

Usage:

```tsx
import { useForm, Field } from '@nekostack/form';
import { Input, Button } from '@nekostack/ui';
import { s } from '@nekostack/schema';

const ProfileSchema = s.object({
  displayName: s.string().min(1).max(50),
  email: s.string().email(),
  bio: s.string().max(280).optional(),
});

function ProfileForm() {
  const form = useForm({
    schema: ProfileSchema,
    onSubmit: async (values) => api.updateProfile(values),
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Field name="displayName" form={form}>
        {(field) => <Input {...field.props} label="Display name" error={field.error} />}
      </Field>
      <Field name="email" form={form}>
        {(field) => <Input {...field.props} label="Email" error={field.error} />}
      </Field>
      <Button type="submit" disabled={form.isSubmitting}>Save</Button>
    </form>
  );
}
```

## Roadmap

### v0.1 — Core state machine
- `createForm()`, field state, basic validation.
- React `useForm` / `useField` hooks.

### v0.2 — Schema integration
- Validation derived from `@nekostack/schema`.
- Error mapping.

### v0.3 — Async validation
- Debounced per-field async checks.
- Cancellation on field change.

### v0.4 — Field bindings
- `Field` component with render-prop pattern.
- `@nekostack/ui` integration documented.

### v0.5 — Conditional fields
- Show-when declarations.
- Reactive computed fields.

### v0.6 — Field arrays
- Repeatable groups with add/remove/reorder.

### v0.7 — Multi-step wizards
- Step machine with branching.
- Per-step validation gates.

### v0.8 — Optimistic submission
- Optimistic updates with rollback on error.

### v1.0 — Stable API
- Documentation site.
- Migration recipes from React Hook Form.

## Product potential

**Internal use:** Essential. Every UI surface that takes input uses this.

**Open source release:** Plausible. Crowded space, but schema-driven first-class is undersupplied. MIT release.

**Commercial product:** Unlikely as a library. A form-builder SaaS (Typeform / Tally) is a different shape and we're not building one.

**Estimated effort to v1.0:** 8-14 weeks of focused work. State machine is well-understood; async validation, conditional fields, and wizard branching are where time goes.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Project unblocker. Forms are ubiquitous; the lack of one consistent layer creates daily friction.
- **Estimated learning return:** High. Form state machines, validation orchestration, conditional reactive UI, async coordination — all transferable to any future UI work.
