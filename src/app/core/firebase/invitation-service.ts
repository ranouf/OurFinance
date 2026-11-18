import type { User } from 'firebase/auth';

export interface InvitationCode { readonly groupId: string; readonly invitationId: string; readonly token: string; }
const codePattern = /^([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$/;

export function parseInvitationCode(value: string): InvitationCode | null {
  const match = codePattern.exec(value.trim());
  return match ? { groupId: match[1], invitationId: match[2], token: match[3] } : null;
}

export class InvitationService {
  constructor(private readonly workerUrl: string, private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private url(path: string): URL {
    const url = new URL(path, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    return url;
  }

  private async headers(user: User): Promise<HeadersInit> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    return { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' };
  }

  async create(user: User, groupId: string, targetEmail: string): Promise<string> {
    const response = await this.transport(this.url(`/groups/${encodeURIComponent(groupId)}/invitations`), {
      method: 'POST', headers: await this.headers(user), body: JSON.stringify({ targetEmail: targetEmail.trim() }),
    });
    if (!response.ok) throw new Error(`Invitation refusée (HTTP ${response.status})`);
    const result = await response.json() as { invitationId?: string; token?: string };
    if (!result.invitationId || !result.token) throw new Error('Réponse invalide');
    return `${groupId}.${result.invitationId}.${result.token}`;
  }

  async accept(user: User, value: string): Promise<void> {
    const code = parseInvitationCode(value);
    if (!code) throw new Error('Code invalide');
    const response = await this.transport(this.url(`/groups/${code.groupId}/invitations/${code.invitationId}/accept`), {
      method: 'POST', headers: await this.headers(user), body: JSON.stringify({ token: code.token }),
    });
    if (!response.ok) throw new Error(`Invitation refusée (HTTP ${response.status})`);
  }
}
