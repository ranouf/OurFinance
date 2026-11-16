import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { decodeStoredPreference } from '../../shared/utils/split-preference';
import type { CategoryId } from '../../shared/utils/categories';
import type { Allocation, SplitMode } from '../../shared/utils/split-engine';
import type { GroupMember } from './group-model';

export interface ExpenseHistoryEntry {
  readonly id: string;
  readonly description: string;
  readonly categoryId: CategoryId;
  readonly date: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly payments: readonly Allocation[];
  readonly allocations: readonly Allocation[];
}

export class ExpenseService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string) {}

  async history(groupId: string, after?: QueryDocumentSnapshot<DocumentData>, from?: string, to?: string): Promise<{ entries: ExpenseHistoryEntry[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean; scanned: number }> {
    const expenses = collection(getFirestore(this.app), 'groups', groupId, 'expenses');
    const ordered = query(expenses, ...(from ? [where('date', '>=', from)] : []), ...(to ? [where('date', '<=', to)] : []), orderBy('date', 'desc'), limit(20), ...(after ? [startAfter(after)] : []));
    const snapshot = await getDocs(ordered);
    return {
      entries: snapshot.docs.filter(item => item.data()['deleted'] !== true).map(item => {
        const data = item.data();
        return {
          id: item.id,
          description: String(data['description']),
          categoryId: typeof data['categoryId'] === 'string' ? data['categoryId'] as CategoryId : 'other',
          date: String(data['date']),
          amountMinor: Number(data['amountMinor']),
          currency: String(data['currency']),
          payments: (data['payments'] as Allocation[] | undefined) ?? [],
          allocations: (data['allocations'] as Allocation[] | undefined) ?? [],
        };
      }),
      last: snapshot.docs.at(-1),
      hasMore: snapshot.size === 20,
      scanned: snapshot.size,
    };
  }

  async members(groupId: string): Promise<GroupMember[]> {
    const snapshot = await getDocs(collection(getFirestore(this.app), 'groups', groupId, 'members'));
    return snapshot.docs.map(item => ({ userId: item.id, role: item.data()['role'] === 'owner' ? 'owner' : 'member', status: item.data()['status'] === 'active' ? 'active' : 'revoked' }));
  }

  async preference(user: User, groupId: string, activeIds: ReadonlySet<string>): Promise<SplitMode | undefined> {
    const snapshot = await getDoc(doc(getFirestore(this.app), 'users', user.uid, 'groupPreferences', groupId));
    if (!snapshot.exists()) return undefined;
    return decodeStoredPreference(snapshot.data()['modeJson'], activeIds);
  }

  async create(user: User, groupId: string, body: object): Promise<string> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/expenses`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(response.status === 503 ? 'Création de dépenses désactivée sur cet environnement' : `Création refusée (HTTP ${response.status})`);
    const result = await response.json() as { expenseId?: string };
    if (!result.expenseId) throw new Error('Réponse Worker invalide');
    return result.expenseId;
  }
}
