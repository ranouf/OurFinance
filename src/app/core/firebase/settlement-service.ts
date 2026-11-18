import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, getDocs, getFirestore, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot, type QuerySnapshot } from 'firebase/firestore';

export interface SettlementRequest {
  readonly idempotencyKey: string;
  readonly date: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly fromUserId: string;
  readonly toUserId: string;
}

export interface SettlementHistoryEntry {
  readonly id: string;
  readonly date: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly fromUserId: string;
  readonly toUserId: string;
}

export interface SettlementRepository {
  history(app: FirebaseApp, groupId: string, after?: QueryDocumentSnapshot<DocumentData>): Promise<QuerySnapshot<DocumentData>>;
}

const firestoreSettlementRepository: SettlementRepository = {
  history: (app, groupId, after) => {
    const settlements = collection(getFirestore(app), 'groups', groupId, 'settlements');
    return getDocs(query(settlements, orderBy('date', 'desc'), limit(20), ...(after ? [startAfter(after)] : [])));
  },
};

export class SettlementService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string,
    private readonly repository: SettlementRepository = firestoreSettlementRepository,
    private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  async history(groupId: string, after?: QueryDocumentSnapshot<DocumentData>): Promise<{ entries: SettlementHistoryEntry[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> {
    const snapshot = await this.repository.history(this.app, groupId, after);
    return {
      entries: snapshot.docs.filter(item => item.data()['deleted'] !== true).map(item => {
        const data = item.data();
        return {
          id: item.id,
          date: String(data['date']),
          currency: String(data['currency']),
          amountMinor: Number(data['amountMinor']),
          fromUserId: String(data['fromUserId']),
          toUserId: String(data['toUserId']),
        };
      }),
      last: snapshot.docs.at(-1),
      hasMore: snapshot.size === 20,
    };
  }

  async create(user: User, groupId: string, request: SettlementRequest): Promise<string> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/settlements`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL du service non sécurisée');
    const response = await this.transport(url, {
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
