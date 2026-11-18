import { FirebaseApp, FirebaseError } from 'firebase/app';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { Group } from './group-model';

export interface GroupRepository {
  memberships(app: FirebaseApp, uid: string): Promise<readonly string[]>;
  group(app: FirebaseApp, groupId: string): Promise<DocumentSnapshot<DocumentData>>;
  memberCount(app: FirebaseApp, groupId: string): Promise<number>;
}

const firestoreGroupRepository: GroupRepository = {
  memberships: async (app, uid) => (await getDocs(collection(getFirestore(app), 'users', uid, 'groupMemberships'))).docs.map(item => item.id),
  group: (app, groupId) => getDoc(doc(getFirestore(app), 'groups', groupId)),
  memberCount: async (app, groupId) => (await getCountFromServer(query(
    collection(getFirestore(app), 'groups', groupId, 'members'), where('status', '==', 'active')))).data().count,
};

export class GroupService {
  constructor(
    private readonly app: FirebaseApp,
    private readonly workerUrl?: string,
    private readonly repository: GroupRepository = firestoreGroupRepository,
    private readonly transport: typeof fetch = (...args) => fetch(...args),
  ) {}

  async list(user: User): Promise<Group[]> {
    const references = await this.repository.memberships(this.app, user.uid);
    const groups = await Promise.all(
      references.map(async (groupId) => {
        try {
          const snapshot = await this.repository.group(this.app, groupId);
          if (!snapshot.exists()) return null;
          const data = snapshot.data();
          const currency = data['currencyCode'] ?? data['currency'];
          if (typeof data['name'] !== 'string' || typeof currency !== 'string') return null;
          const group: Group = {
            id: snapshot.id,
            name: data['name'],
            currency,
            ownerId: String(data['ownerId'] ?? ''),
            currencyLocked: data['currencyLockedAt'] != null,
            status: data['status'] === 'archived' ? 'archived' : 'active',
          };
          try {
            return { ...group, memberCount: await this.repository.memberCount(this.app, snapshot.id) };
          } catch {
            return group;
          }
        } catch (error) {
          // A revoked membership may still have an old user reference.
          if (error instanceof FirebaseError && error.code === 'permission-denied') return null;
          throw error;
        }
      }),
    );
    return groups.filter((group): group is Group => group !== null);
  }

  async create(user: User, name: string, currency: string): Promise<string> {
    if (!user.emailVerified || !this.workerUrl) throw new Error('Création indisponible');
    const url = new URL('/groups', this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await this.transport(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, currency }),
    });
    if (!response.ok) throw new Error('Création impossible');
    const result = (await response.json()) as { groupId?: string };
    if (!result.groupId) throw new Error('Réponse Worker invalide');
    return result.groupId;
  }

  async changeCurrency(user: User, groupId: string, currencyCode: string): Promise<void> {
    if (!user.emailVerified || !this.workerUrl || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId))
      throw new Error('Modification indisponible');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/currency`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await this.transport(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currencyCode }),
    });
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? 'currency_locked'
          : response.status === 503
            ? 'currency_disabled'
            : 'currency_failed',
      );
  }

  async revokeMember(user: User, groupId: string, memberId: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(memberId)) throw new Error('Identifiant membre invalide');
    await this.lifecycle(user, groupId, `/members/${encodeURIComponent(memberId)}/revoke`);
  }

  async archive(user: User, groupId: string): Promise<void> {
    await this.lifecycle(user, groupId, '/archive');
  }

  private async lifecycle(user: User, groupId: string, suffix: string): Promise<void> {
    if (!user.emailVerified || !this.workerUrl || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId))
      throw new Error('Cycle de vie indisponible');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}${suffix}`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await this.transport(url, {
      method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}));
      const code = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error : 'group_unavailable';
      throw new GroupLifecycleRequestError(response.status, code);
    }
  }
}

export class GroupLifecycleRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
