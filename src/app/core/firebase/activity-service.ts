import type { FirebaseApp } from 'firebase/app';
import { collection, getDocs, getFirestore, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot, type QuerySnapshot, type Timestamp } from 'firebase/firestore';

export interface ActivityEntry {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly at: Timestamp;
}

export interface ActivityRepository {
  history(app: FirebaseApp, groupId: string, after: QueryDocumentSnapshot<DocumentData> | undefined, pageSize: number): Promise<QuerySnapshot<DocumentData>>;
}

const firestoreActivityRepository: ActivityRepository = {
  history: (app, groupId, after, pageSize) => getDocs(query(
    collection(getFirestore(app), 'groups', groupId, 'activity'), orderBy('at', 'desc'), limit(pageSize),
    ...(after ? [startAfter(after)] : []))),
};

export class ActivityService {
  constructor(private readonly app: FirebaseApp, private readonly repository: ActivityRepository = firestoreActivityRepository) {}

  async history(groupId: string, after?: QueryDocumentSnapshot<DocumentData>, pageSize = 20): Promise<{ entries: ActivityEntry[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(groupId) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50)
      throw new Error('Page d’activité invalide');
    const snapshot = await this.repository.history(this.app, groupId, after, pageSize);
    return {
      entries: snapshot.docs.map(item => ({ id: item.id, actorId: String(item.data()['actorId']), action: String(item.data()['action']), at: item.data()['at'] as Timestamp })),
      last: snapshot.docs.at(-1),
      hasMore: snapshot.size === pageSize,
    };
  }
}
