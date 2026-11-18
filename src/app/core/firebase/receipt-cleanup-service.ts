import type { User } from 'firebase/auth';

export type ReceiptCleanupResult = { readonly status: 200 | 202; readonly cleaned: number; readonly pending: number };
export type ReceiptCleanupErrorCode = 'quota' | 'denied' | 'unavailable';

export class ReceiptCleanupError extends Error {
  constructor(readonly code: ReceiptCleanupErrorCode) { super(code); }
}

export class ReceiptCleanupService {
  constructor(private readonly workerUrl: string, private readonly transport: typeof fetch = (input, init) => fetch(input, init)) {}

  async run(user: Pick<User, 'getIdToken'>, groupId: string): Promise<ReceiptCleanupResult> {
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/receipt-upload-jobs/cleanup`, this.workerUrl);
    if (url.protocol !== 'https:') throw new ReceiptCleanupError('unavailable');
    const response = await this.transport(url, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) throw new ReceiptCleanupError('denied');
    if (response.status === 503) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new ReceiptCleanupError(body?.error === 'provider_quota_exceeded' ? 'quota' : 'unavailable');
    }
    if (response.status !== 200 && response.status !== 202) throw new ReceiptCleanupError('unavailable');
    const body = await response.json() as { cleaned?: number; pending?: number };
    if (![body.cleaned, body.pending].every(value => Number.isSafeInteger(value) && value! >= 0)) throw new ReceiptCleanupError('unavailable');
    return { status: response.status, cleaned: body.cleaned!, pending: body.pending! };
  }
}
