import type { User } from 'firebase/auth';

/** All privileged restore traffic goes through the authenticated Worker. */
export class RestoreService {
  constructor(private readonly workerUrl: string, private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private url(groupId: string, restoreId?: string, suffix = ''): URL {
    const id = /^[A-Za-z0-9_-]{1,128}$/;
    if (!id.test(groupId) || (restoreId !== undefined && !id.test(restoreId))) throw new Error('restore_id_invalid');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/backup/${restoreId ? `restores/${encodeURIComponent(restoreId)}${suffix}` : 'preview'}`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('insecure_url');
    return url;
  }

  async preview(user: Pick<User, 'emailVerified' | 'getIdToken'>, groupId: string, archive: Uint8Array): Promise<Response> {
    if (!user.emailVerified) throw new Error('email_unverified');
    const url = this.url(groupId);
    return this.transport(url, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/zip' },
      body: this.copy(archive), cache: 'no-store' });
  }

  async postArchive(token: string, groupId: string, restoreId: string, step: 'restore' | 'prepare' | 'commit', archive: Uint8Array): Promise<Response> {
    const url = this.url(groupId, restoreId, step === 'restore' ? '' : `/${step}`);
    return this.transport(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' },
      body: this.copy(archive), cache: 'no-store' });
  }

  async stageReceipt(token: string, groupId: string, restoreId: string, index: number, contentType: string, bytes: Uint8Array): Promise<Response> {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('restore_index_invalid');
    const url = this.url(groupId, restoreId, `/receipts/${index}`);
    return this.transport(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: this.copy(bytes), cache: 'no-store' });
  }

  async cleanup(token: string, groupId: string, restoreId: string): Promise<Response> {
    return this.transport(this.url(groupId, restoreId, '/cleanup'),
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  }

  async outcome(token: string, groupId: string, restoreId: string): Promise<Response> {
    return this.transport(this.url(groupId, restoreId, '/outcome'),
      { method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  }

  async current(token: string, groupId: string): Promise<Response> {
    return this.transport(this.url(groupId, 'current'),
      { method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  }

  private copy(bytes: Uint8Array): ArrayBuffer {
    if (bytes.byteLength > 20_000_000) throw new Error('archive_too_large');
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }
}
