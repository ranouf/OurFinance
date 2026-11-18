import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { collection, getDocs, getFirestore, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot, type QuerySnapshot, type Timestamp } from 'firebase/firestore';

export interface ExpenseComment {
  readonly id: string;
  readonly authorId: string;
  readonly text: string;
  readonly createdAt: Timestamp;
}

export interface CommentRepository {
  history(app: FirebaseApp, groupId: string, expenseId: string, after?: QueryDocumentSnapshot<DocumentData>): Promise<QuerySnapshot<DocumentData>>;
}

const firestoreCommentRepository: CommentRepository = {
  history: (app, groupId, expenseId, after) => {
    const comments = collection(getFirestore(app), 'groups', groupId, 'expenses', expenseId, 'comments');
    return getDocs(query(comments, orderBy('createdAt', 'desc'), limit(20), ...(after ? [startAfter(after)] : [])));
  },
};

export class CommentService {
  constructor(private readonly app: FirebaseApp, private readonly workerUrl: string,
    private readonly repository: CommentRepository = firestoreCommentRepository,
    private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  async history(groupId: string, expenseId: string, after?: QueryDocumentSnapshot<DocumentData>): Promise<{ entries: ExpenseComment[]; last?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> {
    const snapshot = await this.repository.history(this.app, groupId, expenseId, after);
    return {
      entries: snapshot.docs.map(item => ({ id: item.id, authorId: String(item.data()['authorId']), text: String(item.data()['text']), createdAt: item.data()['createdAt'] as Timestamp })),
      last: snapshot.docs.at(-1),
      hasMore: snapshot.size === 20,
    };
  }

  async create(user: User, groupId: string, expenseId: string, text: string, idempotencyKey: string): Promise<void> {
    if (!user.emailVerified) throw new Error('Adresse courriel non confirmée');
    const url = new URL(`/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}/comments`, this.workerUrl);
    if (url.protocol !== 'https:') throw new Error('URL Worker non sécurisée');
    const response = await this.transport(url, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, idempotencyKey }) });
    if (!response.ok) throw new Error(response.status === 503 ? 'Commentaires désactivés sur cet environnement' : `Commentaire refusé (HTTP ${response.status})`);
  }
}
