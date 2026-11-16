import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import { decodeStoredPreference } from '../../shared/utils/split-preference';
import type { SplitMode } from '../../shared/utils/split-engine';
import type { GroupMember } from './group-model';

export class ExpenseService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string) {}

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
