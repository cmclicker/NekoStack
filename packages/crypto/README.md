# @nekostack/crypto

> Safe wrappers around vetted cryptographic primitives. Hashing, signing, encryption, key derivation, random IDs. **Does not reinvent crypto** — wraps libsodium / Node crypto with NekoStack-conventional usage patterns and misuse guardrails.

## Quick reference

| | |
|---|---|
| **Build tier** | Security — substrate |
| **Depends on** | external: `libsodium-wrappers` and/or Node `crypto`; `schema` for typed outputs |
| **Used by** | `auth` (token signing helpers), `secrets` (at-rest encryption), `audit` (hash chains), `storage` (at-rest encryption), `webhooks` (HMAC signatures), `id` (cryptographic random IDs) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — substrate-wrapping is plumbing |

## Why this exists

The most dangerous crypto code is the code that *looks* like crypto code but isn't. Developers reach for `crypto.randomBytes` thinking it's safe, but pass the wrong length, use ECB mode by accident, hand-roll AES-CBC and forget the MAC. CVEs follow.

`crypto` wraps battle-tested libraries (libsodium first; Node `crypto` as fallback) with NekoStack-conventional **misuse-resistant** APIs:

- `encryptAtRest(plaintext, key)` — always XChaCha20-Poly1305, nonce auto-generated, never accepts a wrong-size key.
- `signHmac(payload, key)` — always SHA-256, key length checked.
- `hashChainLink(prev, payload)` — for audit's hash chain.
- `derive(masterKey, context, length)` — HKDF-style derivation with required context binding.

**We don't write crypto.** We wrap correctly.

## Scope

### In scope
- Hashing helpers (SHA-256, BLAKE2, Argon2 for passwords — though `auth` handles passwords directly).
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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §33 for the full capability map.

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
- **Misuse-resistant by construction.** Wrong-size keys → compile error. Forgetting a nonce → impossible.
- **Constant-time by default.** Comparisons use timing-safe ops.
- **Algorithms picked for us, not for you.** We pick XChaCha20-Poly1305, Ed25519, HKDF-SHA256 — you don't get to choose AES-ECB.

## Architecture sketch

```
packages/crypto/
├── src/
│   ├── hash/
│   │   ├── sha256.ts
│   │   ├── blake2.ts
│   │   └── argon2.ts
│   ├── hmac/
│   │   ├── sign.ts
│   │   └── verify.ts
│   ├── encrypt/
│   │   ├── at-rest.ts        # XChaCha20-Poly1305
│   │   └── stream.ts
│   ├── sign/
│   │   └── ed25519.ts
│   ├── derive/
│   │   ├── hkdf.ts
│   │   └── scrypt.ts
│   ├── random/
│   │   └── csprng.ts
│   ├── chain/
│   │   └── hash-link.ts
│   └── compare/
│       └── constant-time.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Hash + HMAC wrappers
### v0.2 — Symmetric encryption
### v0.3 — Key derivation
### v0.4 — CSPRNG IDs
### v0.5 — Hash chains
### v0.6 — Ed25519 signatures
### v1.0 — Stable API + security audit

## Product potential

**Internal:** Required by many security-touching packages.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Security — substrate.
- **Estimated learning return:** Very high. Misuse-resistant API design is a real CS topic; constant-time comparisons, KDF binding, AEAD semantics — all foundational.
