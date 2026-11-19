interface AttemptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const restoreIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Keeps only the attempt identifier; the server still checks owner access. */
export class RestoreAttemptStore {
  constructor(private readonly storage: AttemptStorage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {}

  private key(uid: string, groupId: string): string { return `ourfinance.restoreAttempt.${uid}.${groupId}`; }

  remember(uid: string, groupId: string, restoreId: string): void {
    if (!restoreIdPattern.test(restoreId)) return;
    try { this.storage?.setItem(this.key(uid, groupId), restoreId); } catch { /* The current tab can still check the outcome. */ }
  }

  find(uid: string, groupIds: readonly string[]): { groupId: string; restoreId: string } | undefined {
    for (const groupId of groupIds) {
      let restoreId: string | null;
      try { restoreId = this.storage?.getItem(this.key(uid, groupId)) ?? null; } catch { return undefined; }
      if (restoreId && restoreIdPattern.test(restoreId)) return { groupId, restoreId };
      if (restoreId) this.forget(uid, groupId, restoreId);
    }
    return undefined;
  }

  forget(uid: string, groupId: string, restoreId: string): void {
    try {
      const key = this.key(uid, groupId);
      if (this.storage?.getItem(key) === restoreId) this.storage.removeItem(key);
    } catch { /* Keep the confirmed result visible in the current tab. */ }
  }
}
