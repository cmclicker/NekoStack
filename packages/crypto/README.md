# @nekostack/crypto

> Safe wrappers around vetted cryptographic primitives. Hashing, signing, encryption, key derivation, random IDs. **Does not reinvent crypto** â€” wraps libsodium / Node crypto with NekoStack-conventional usage patterns and misuse guardrails.

## Quick reference

| | |
|---|---|
| **Build tier** | Security â€” substrate |
| **Depends on** | external: `libsodium-wrappers` and/or Node `crypto`; `schema` for typed outputs |
| **Used by** | `auth` (token signing helpers), `secrets` (at-rest encryption), `audit` (hash chains), `storage` (at-rest encryption), `webhooks` (HMAC signatures), `id` (cryptographic random IDs) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

The most dangerous crypto code is the code that *looks* like crypto code but isn't. Developers reach for `crypto.randomBytes` thinking it's safe, but pass the wrong length, use ECB mode by accident, hand-roll AES-CBC and forget the MAC. CVEs follow.

`crypto` wraps battle-tested libraries (libsodium first; Node `crypto` as fallback) with NekoStack-conventional **misuse-resistant** APIs:

- `encryptAtRest(plaintext, key)` â€” always XChaCha20-Poly1305, nonce auto-generated, never accepts a wrong-size key.
- `signHmac(payload, key)` â€” always SHA-256, key length checked.
- `hashChainLink(prev, payload)` â€” for audit's hash chain.
- `derive(masterKey, context, length)` â€” HKDF-style derivation with required context binding.

**We don't write crypto.** We wrap correctly.

## Scope

### In scope
- Hashing helpers (SHA-256, BLAKE2, Argon2 for passwords â€” though `auth` handles passwords directly).
- HMAC signing + verification.
- Symmetric encryption at-rest (XChaCha20-Poly1305 via libsodium).
- Asymmetric signing (Ed25519).
- Key derivation (HKDF, scrypt for password-derived keys).
- Cryptographic random (CSPRNG-based ID generation).
- Hash chains (for `audit`).
- Constant-time comparison.
- Misuse guardrails (wrong-size keys rejected at compile time where possible).

### Out of scope
- TLS / certificate management.
- OAuth flow internals.
- Password hashing primitives (we expose Argon2 wrapper but `auth` orchestrates).
- Generating cryptographic primitives from scratch.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§33 for the full capability map.

### Owns
- Hashing wrappers
- HMAC sign + verify
- Symmetric + asymmetric encryption wrappers
- Key derivation
- CSPRNG IDs
- Hash chains
- Constant-time compare

### Does NOT own
| Capability | Lives in |
|---|---|
| Secret loading / rotation | `secrets` |
| Security headers / CSRF / CORS | `secure` |
| Login flow / session crypto | `auth` (uses our wrappers) |
| Password hashing orchestration | `auth` |
| ID generation conventions (non-crypto) | `id` |
| TLS / certificate ops | external |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **libsodium-wrappers** | Mature, misuse-resistant. | Substrate; we wrap with NekoStack patterns. |
| **Node `crypto`** | Built-in. | Powerful but easy to misuse. |
| **`@noble/ciphers`** | Modern audited. | Substrate-ish. |

## How this fits the NekoStack

- **`auth`** uses our HMAC + key-derivation for token signing.
- **`secrets`** uses our encryption for at-rest secrets.
- **`audit`** uses our hash-chain helpers.
- **`storage`** uses our encryption for at-rest objects.
- **`webhooks`** uses our HMAC for signature verification.

## Design philosophy

- **Don't reinvent.** Wrap libsodium first.
- **Misuse-resistant by construction.** Wrong-size keys â†’ compile error. Forgetting a nonce â†’ impossible.
- **Constant-time by default.** Comparisons use timing-safe ops.
- **Algorithms picked for us, not for you.** We pick XChaCha20-Poly1305, Ed25519, HKDF-SHA256 â€” you don't get to choose AES-ECB.

## Architecture sketch

```
packages/crypto/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ hash/
â”‚   â”‚   â”œâ”€â”€ sha256.ts
â”‚   â”‚   â”œâ”€â”€ blake2.ts
â”‚   â”‚   â””â”€â”€ argon2.ts
â”‚   â”œâ”€â”€ hmac/
â”‚   â”‚   â”œâ”€â”€ sign.ts
â”‚   â”‚   â””â”€â”€ verify.ts
â”‚   â”œâ”€â”€ encrypt/
â”‚   â”‚   â”œâ”€â”€ at-rest.ts        # XChaCha20-Poly1305
â”‚   â”‚   â””â”€â”€ stream.ts
â”‚   â”œâ”€â”€ sign/
â”‚   â”‚   â””â”€â”€ ed25519.ts
â”‚   â”œâ”€â”€ derive/
â”‚   â”‚   â”œâ”€â”€ hkdf.ts
â”‚   â”‚   â””â”€â”€ scrypt.ts
â”‚   â”œâ”€â”€ random/
â”‚   â”‚   â””â”€â”€ csprng.ts
â”‚   â”œâ”€â”€ chain/
â”‚   â”‚   â””â”€â”€ hash-link.ts
â”‚   â””â”€â”€ compare/
â”‚       â””â”€â”€ constant-time.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Hash + HMAC wrappers
### v0.2 â€” Symmetric encryption
### v0.3 â€” Key derivation
### v0.4 â€” CSPRNG IDs
### v0.5 â€” Hash chains
### v0.6 â€” Ed25519 signatures
### v1.0 â€” Stable API + security audit

## Product potential

**Internal:** Required by many security-touching packages.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Security â€” substrate.
- **Estimated learning return:** Very high. Misuse-resistant API design is a real CS topic; constant-time comparisons, KDF binding, AEAD semantics â€” all foundational.
