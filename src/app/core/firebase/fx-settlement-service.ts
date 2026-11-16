import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, getDocs, getFirestore, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

export interface FxSettlementRequest {
  readonly idempotencyKey: string;
  readonly date: string;
  readonly debtCurrency: string;
  readonly debtAmountMinor: number;
  readonly paymentCurrency: string;
  readonly paymentAmountMinor: number;
  readonly rate: string;
  readonly rateDate: string;
  readonly fromUserId: string;
  readonly toUserId: string;
}

export interface FxSettlementEntry extends FxSettlementRequest { readonly id: string; }

export class FxSettlementService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string) {}

  async create(user: User, groupId: string, request: FxSettlementRequest): Promise<string> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/fx-settlements`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL du service non sécurisée');
    const response = await fetch(url, { method: 'POST', headers: {
      Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify(request) });
    if (!response.ok) throw new Error(response.status === 503 ? 'Remboursements multidevises désactivés sur cet environnement' : `Enregistrement refusé (HTTP ${response.status})`);
    const result = await response.json() as { fxSettlementId?: string };
    if (!result.fxSettlementId) throw new Error('Réponse du service invalide');
    return result.fxSettlementId;
  }

  async history(groupId: string, after?: QueryDocumentSnapshot<DocumentData>): Promise<{ entries: FxSettlementEntry[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> {
    const source = collection(getFirestore(this.app), 'groups', groupId, 'fxSettlements');
    const snapshot = await getDocs(query(source, orderBy('date', 'desc'), limit(20), ...(after ? [startAfter(after)] : [])));
    return {
      entries: snapshot.docs.filter(item => item.data()['deleted'] !== true).map(item => {
        const data = item.data();
        return {
          id: item.id, idempotencyKey: item.id, date: String(data['date']), debtCurrency: String(data['debtCurrency']),
          debtAmountMinor: Number(data['debtAmountMinor']), paymentCurrency: String(data['paymentCurrency']),
          paymentAmountMinor: Number(data['paymentAmountMinor']), rate: String(data['rate']), rateDate: String(data['rateDate']),
          fromUserId: String(data['fromUserId']), toUserId: String(data['toUserId']),
        };
      }),
      last: snapshot.docs.at(-1), hasMore: snapshot.size === 20,
    };
  }
}
