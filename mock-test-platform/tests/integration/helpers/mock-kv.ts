export class MockKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = opts?.expirationTtl
      ? Date.now() + opts.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Test helper — seed without TTL */
  seed(key: string, value: unknown): this {
    this.store.set(key, { value: typeof value === "string" ? value : JSON.stringify(value) });
    return this;
  }

  /** Test helper — check key exists (ignoring TTL) */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Test helper — read raw value synchronously */
  peek(key: string): string | undefined {
    return this.store.get(key)?.value;
  }

  /** Test helper — expire a key immediately */
  expire(key: string): void {
    const entry = this.store.get(key);
    if (entry) this.store.set(key, { ...entry, expiresAt: Date.now() - 1 });
  }
}
