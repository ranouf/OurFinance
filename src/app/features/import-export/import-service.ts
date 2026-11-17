import type { User } from 'firebase/auth';
import type { PreparedImportBatch } from './prepare-batch';

/** Thin authenticated client; the Worker is the sole authority for writes. */
export class ImportService {
  constructor(private readonly workerUrl: string, private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private endpoint(groupId: string, batchId?: string): URL {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(groupId) ||
        (batchId !== undefined && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(batchId))) {
      throw new Error('Identifiant d’import invalide');
    }
    const base = new URL(this.workerUrl);
    if (base.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    return new URL(`/groups/${groupId}/imports${batchId ? `/${batchId}` : ''}`, base);
  }

  private async headers(user: Pick<User, 'emailVerified' | 'getIdToken'>): Promise<HeadersInit> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    return { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' };
  }

  async create(user: Pick<User, 'emailVerified' | 'getIdToken'>, batch: PreparedImportBatch): Promise<string> {
    const url = this.endpoint(batch.groupId);
    const response = await this.transport(url, {
      method: 'POST', headers: await this.headers(user), body: JSON.stringify(batch.body), redirect: 'error',
    });
    if (!response.ok) throw new Error(response.status === 503 ? 'Import désactivé sur cet environnement' : `Import refusé (HTTP ${response.status})`);
    const result = await response.json() as { batchId?: unknown; recordCount?: unknown };
    if (result.batchId !== batch.body.batchId || result.recordCount !== batch.body.records.length) throw new Error('Réponse Worker invalide');
    return result.batchId;
  }

  async undo(user: Pick<User, 'emailVerified' | 'getIdToken'>, groupId: string, batchId: string): Promise<void> {
    const url = this.endpoint(groupId, batchId);
    const response = await this.transport(url, { method: 'DELETE', headers: await this.headers(user), redirect: 'error' });
    if (response.status !== 204) throw new Error(response.status === 503 ? 'Annulation désactivée sur cet environnement' : `Annulation refusée (HTTP ${response.status})`);
  }
}
