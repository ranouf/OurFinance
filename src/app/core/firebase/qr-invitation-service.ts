import type { User } from 'firebase/auth';
import { validateInviteLink } from './pending-invite';

export interface QrInviteCreated { readonly invitationId: string; readonly link: string; readonly expiresAt: string; }
export interface QrInvitePreview { readonly groupName: string; readonly currency: string; readonly expiresAt: string; }
export interface QrInviteEntry { readonly invitationId: string; readonly status: string; readonly expiresAt: string; readonly targetEmail: string | null; }
export interface QrInviteList { readonly invitations: QrInviteEntry[]; readonly nextPageToken: string | null; }
export class QrInviteRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export class QrInvitationService {
  constructor(private readonly workerUrl: string,
    private readonly transport: typeof fetch = (...args) => fetch(...args),
    private readonly origin: () => string = () => window.location.origin) {}

  private url(path: string): URL {
    const url = new URL(path, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('Worker URL must be HTTPS');
    return url;
  }

  private async request<T>(user: User, path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    if (!user.emailVerified) throw new QrInviteRequestError(403, 'email_unverified');
    const response = await this.transport(this.url(path), {
      method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string };
      throw new QrInviteRequestError(response.status, error.error ?? 'invitation_unavailable');
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async create(user: User, groupId: string, targetEmail?: string): Promise<QrInviteCreated> {
    const result = await this.request<QrInviteCreated>(user, `/groups/${encodeURIComponent(groupId)}/qr-invitations`, 'POST', targetEmail ? { targetEmail } : {});
    return { ...result, link: validateInviteLink(result.link, this.origin()) };
  }

  list(user: User, groupId: string, pageToken?: string): Promise<QrInviteList> {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    return this.request(user, `/groups/${encodeURIComponent(groupId)}/qr-invitations${query}`, 'GET');
  }

  preview(user: User, token: string): Promise<QrInvitePreview> {
    return this.request(user, '/qr-invitations/preview', 'POST', { token });
  }

  accept(user: User, token: string): Promise<{ groupId: string }> {
    return this.request(user, '/qr-invitations/accept', 'POST', { token });
  }

  revoke(user: User, groupId: string, invitationId: string): Promise<void> {
    return this.request(user, `/groups/${encodeURIComponent(groupId)}/qr-invitations/${encodeURIComponent(invitationId)}/revoke`, 'POST');
  }
}
