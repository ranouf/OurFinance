import type { FirebaseApp } from 'firebase/app';
import { collection, getDocs, getFirestore, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';

export interface ActivityEntry {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly at: Timestamp;
}

export class ActivityService {
  constructor(private readonly app: FirebaseApp) {}

  async history(groupId: string, after?: QueryDocumentSnapshot<DocumentData>, pageSize = 20): Promise<{ entries: ActivityEntry[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> {
    const activity = collection(getFirestore(this.app), 'groups', groupId, 'activity');
    const snapshot = await getDocs(query(activity, orderBy('at', 'desc'), limit(pageSize), ...(after ? [startAfter(after)] : [])));
    return {
      entries: snapshot.docs.map(item => ({ id: item.id, actorId: String(item.data()['actorId']), action: String(item.data()['action']), at: item.data()['at'] as Timestamp })),
      last: snapshot.docs.at(-1),
      hasMore: snapshot.size === pageSize,
    };
  }
}
