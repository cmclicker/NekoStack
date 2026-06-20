const REDACTED = '[REDACTED]';

/**
 * Wraps a secret value so it can be accessed explicitly via `.reveal()`
 * but never accidentally logged, serialized, or stringified.
 *
 * Use `.reveal()` only at the call site that actually needs the raw value
 * (e.g., passing the DB URL to a connection pool constructor).
 */
export class Secret<T> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  reveal(): T {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }
}
