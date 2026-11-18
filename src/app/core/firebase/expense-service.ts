import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, startAfter, where, type DocumentData, type DocumentSnapshot, type QueryDocumentSnapshot, type QuerySnapshot } from 'firebase/firestore';
import { decodeStoredPreference } from '../../shared/utils/split-preference';
import { categoryById, type CategoryColor } from '../../shared/utils/categories';
import type { Allocation, SplitMode } from '../../shared/utils/split-engine';
import type { GroupMember } from './group-model';

export interface ExpenseHistoryEntry {
  readonly id: string;
  readonly createdBy: string;
  readonly revision: number;
  readonly description: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly categoryIcon: string;
  readonly categoryColor: CategoryColor;
  readonly date: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly payments: readonly Allocation[];
  readonly allocations: readonly Allocation[];
  readonly splitMode?: SplitMode;
}

export interface ExpenseRepository {
  history(app: FirebaseApp, groupId: string, after?: QueryDocumentSnapshot<DocumentData>, from?: string, to?: string): Promise<QuerySnapshot<DocumentData>>;
  members(app: FirebaseApp, groupId: string): Promise<QuerySnapshot<DocumentData>>;
  preference(app: FirebaseApp, uid: string, groupId: string): Promise<DocumentSnapshot<DocumentData>>;
}
const firestoreExpenseRepository: ExpenseRepository = {
  history: (app, groupId, after, from, to) => {
    const expenses = collection(getFirestore(app), 'groups', groupId, 'expenses');
    const ordered = query(expenses, ...(from ? [where('date', '>=', from)] : []), ...(to ? [where('date', '<=', to)] : []),
      orderBy('date', 'desc'), limit(20), ...(after ? [startAfter(after)] : []));
    return getDocs(ordered);
  },
  members: (app, groupId) => getDocs(collection(getFirestore(app), 'groups', groupId, 'members')),
  preference: (app, uid, groupId) => getDoc(doc(getFirestore(app), 'users', uid, 'groupPreferences', groupId)),
};

export class ExpenseService {
  constructor(
    private readonly app: FirebaseApp,
    private readonly workerUrl: string,
    private readonly repository: ExpenseRepository = firestoreExpenseRepository,
    private readonly transport: typeof fetch = (...args) => fetch(...args),
  ) {}

  async history(groupId: string, after?: QueryDocumentSnapshot<DocumentData>, from?: string, to?: string): Promise<{ entries: ExpenseHistoryEntry[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean; scanned: number }> {
    const snapshot = await this.repository.history(this.app, groupId, after, from, to);
    return {
      entries: snapshot.docs.filter(item => item.data()['deleted'] !== true).map(item => {
        const data = item.data();
        const fallback = categoryById(String(data['categoryId'] ?? 'other'));
        return {
          id: item.id,
          createdBy: String(data['createdBy'] ?? ''),
          revision: Number(data['revision'] ?? 0),
          description: String(data['description']),
          categoryId: String(data['categoryId'] ?? 'other'),
          categoryLabel: String(data['categoryLabel'] ?? fallback.label),
          categoryIcon: String(data['categoryIcon'] ?? fallback.icon),
          categoryColor: (data['categoryColor'] ?? fallback.color) as CategoryColor,
          date: String(data['date']),
          amountMinor: Number(data['amountMinor']),
          currency: String(data['currency']),
          payments: (data['payments'] as Allocation[] | undefined) ?? [],
          allocations: (data['allocations'] as Allocation[] | undefined) ?? [],
          splitMode: data['splitSnapshotJson'] ? JSON.parse(String(data['splitSnapshotJson'])) as SplitMode : undefined,
        };
      }),
      last: snapshot.docs.at(-1),
      hasMore: snapshot.size === 20,
      scanned: snapshot.size,
    };
  }

  async members(groupId: string): Promise<GroupMember[]> {
    const snapshot = await this.repository.members(this.app, groupId);
    return snapshot.docs.map(item => ({ userId: item.id, role: item.data()['role'] === 'owner' ? 'owner' : 'member', status: item.data()['status'] === 'active' ? 'active' : 'revoked' }));
  }

  async preference(user: User, groupId: string, activeIds: ReadonlySet<string>): Promise<SplitMode | undefined> {
    const snapshot = await this.repository.preference(this.app, user.uid, groupId);
    if (!snapshot.exists()) return undefined;
    return decodeStoredPreference(snapshot.data()['modeJson'], activeIds);
  }

  async create(user: User, groupId: string, body: object): Promise<string> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/expenses`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await this.transport(url, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(response.status === 503 ? 'Création de dépenses désactivée sur cet environnement' : `Création refusée (HTTP ${response.status})`);
    const result = await response.json() as { expenseId?: string };
    if (!result.expenseId) throw new Error('Réponse Worker invalide');
    return result.expenseId;
  }

  async mutate(user: User, groupId: string, expenseId: string, method: 'PATCH' | 'DELETE', body: object): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await this.transport(url, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(response.status === 503 ? 'Modification des dépenses désactivée sur cet environnement' : `Modification refusée (HTTP ${response.status})`);
  }
}
