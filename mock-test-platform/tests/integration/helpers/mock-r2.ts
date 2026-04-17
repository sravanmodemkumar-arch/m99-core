interface R2Object {
  body: string;
  customMetadata?: Record<string, string>;
  httpMetadata?: Record<string, string>;
}

export class MockR2 {
  private store = new Map<string, R2Object>();

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return {
      body:           entry.body,
      customMetadata: entry.customMetadata ?? {},
      httpMetadata:   entry.httpMetadata   ?? {},
      json:           () => Promise.resolve(JSON.parse(entry.body)),
      text:           () => Promise.resolve(entry.body),
    };
  }

  async put(
    key: string,
    value: string,
    opts?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }
  ): Promise<void> {
    this.store.set(key, {
      body:           value,
      customMetadata: opts?.customMetadata,
      httpMetadata:   opts?.httpMetadata,
    });
  }

  /** Test helper — seed without metadata */
  seed(key: string, value: unknown): this {
    this.store.set(key, { body: typeof value === "string" ? value : JSON.stringify(value) });
    return this;
  }

  /** Test helper — check key exists */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Test helper — read stored object parsed as JSON */
  getJSON<T = unknown>(key: string): T | null {
    const entry = this.store.get(key);
    return entry ? (JSON.parse(entry.body) as T) : null;
  }

  /** Test helper — list all keys matching a prefix */
  keys(prefix = ""): string[] {
    return [...this.store.keys()].filter(k => k.startsWith(prefix));
  }
}
