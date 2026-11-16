import { FirebaseApp } from 'firebase/app';
import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import { Group } from './group-model';

export class GroupService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl?: string) {}

  async list(user: User): Promise<Group[]> {
    const db = getFirestore(this.app);
    const references = await getDocs(collection(db, 'users', user.uid, 'groupMemberships'));
    const groups = await Promise.all(references.docs.map(async reference => {
      const snapshot = await getDoc(doc(db, 'groups', reference.id));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      const currency = data['currencyCode'] ?? data['currency'];
      if (typeof data['name'] !== 'string' || typeof currency !== 'string') return null;
      const group: Group = { id: snapshot.id, name: data['name'], currency, ownerId: String(data['ownerId'] ?? ''), currencyLocked: data['currencyLockedAt'] != null, status: data['status'] === 'archived' ? 'archived' : 'active' };
      return group;
    }));
    return groups.filter((group): group is Group => group !== null);
  }

  async create(user: User, name: string, currency: string): Promise<string> {
    if (!user.emailVerified || !this.workerUrl) throw new Error('Création indisponible');
    const url = new URL('/groups', this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, currency }),
    });
    if (!response.ok) throw new Error('Création impossible');
    const result = await response.json() as { groupId?: string };
    if (!result.groupId) throw new Error('Réponse Worker invalide');
    return result.groupId;
  }

  async changeCurrency(user: User, groupId: string, currencyCode: string): Promise<void> {
    if (!user.emailVerified || !this.workerUrl || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)) throw new Error('Modification indisponible');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/currency`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currencyCode }),
    });
    if (!response.ok) throw new Error(response.status === 403 ? 'currency_locked' : response.status === 503 ? 'currency_disabled' : 'currency_failed');
  }
}
