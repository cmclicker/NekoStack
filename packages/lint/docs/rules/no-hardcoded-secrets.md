# `no-hardcoded-secrets`

Flags string literals assigned to secret-named variables and well-known credential value prefixes.

## Why

Hardcoded credentials committed to source control are one of the most common causes of security incidents. This rule catches two classes of mistakes:

1. **Secret-named bindings** — variables whose name contains `password`, `apiKey`, `token`, `secret`, `privateKey`, `clientSecret`, `accessKey`, or `authKey` assigned to a non-empty string literal.
2. **Credential value prefixes** — string literals whose value starts with a well-known credential prefix regardless of variable name: Stripe (`sk_live_`, `pk_live_`), GitHub (`ghp_`, `gho_`, `ghs_`), AWS (`AKIA`), Google (`AIza`), Slack (`xoxb-`), or PEM headers (`-----BEGIN`).

Test files are fully exempt.

## Examples

### Incorrect

```ts
const apiKey = 'abc123secretvalue';

const config = { password: 'hunter2' };

const token = 'ghp_xxxxxxxxxxxxxxxxxxxx';
```

### Correct

```ts
import { config } from '@nekostack/config';

const apiKey = config.stripeApiKey;

// Empty strings and placeholders are fine
const password = '';
const token = process.env.TOKEN; // still caught by no-direct-process-env
```

## Options

None.

## When to disable

Never disable for production code. For tests that need to exercise secret-detection logic itself, the rule is automatically disabled in test files (`.test.ts`, `.spec.ts`, `tests/`).
