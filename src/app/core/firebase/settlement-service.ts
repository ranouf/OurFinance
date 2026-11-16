import type { User } from 'firebase/auth';

export interface SettlementRequest {
  readonly idempotencyKey: string;
  readonly date: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly fromUserId: string;
  readonly toUserId: string;
}

export class SettlementService {
  constructor(private readonly workerUrl: string) {}

  async create(user: User, groupId: string, request: SettlementRequest): Promise<string> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/settlements`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL du service non sécurisée');
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(response.status === 503 ? 'Remboursements désactivés sur cet environnement' : `Enregistrement refusé (HTTP ${response.status})`);
    const result = await response.json() as { settlementId?: string };
    if (!result.settlementId) throw new Error('Réponse du service invalide');
    return result.settlementId;
  }
}
