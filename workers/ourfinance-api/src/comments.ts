import { serviceAccessToken } from './service-account';

export interface CommentEnv { readonly FIREBASE_PROJECT_ID: string; readonly FIREBASE_SERVICE_ACCOUNT_JSON: string; }
export class CommentError extends Error {
  constructor(readonly status: 400 | 403 | 409 | 503, readonly code: string) { super(code); }
}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const string = (stringValue: string) => ({ stringValue });
const field = (document: Record<string, unknown> | null, key: string) => (document?.['fields'] as Record<string, { stringValue?: string; booleanValue?: boolean }> | undefined)?.[key];

export function parseComment(value: unknown): { idempotencyKey: string; text: string } {
  if (!value || typeof value !== 'object') throw new CommentError(400, 'invalid_comment');
  const input = value as Record<string, unknown>;
  if (typeof input['idempotencyKey'] !== 'string' || !uuidPattern.test(input['idempotencyKey']) ||
      typeof input['text'] !== 'string' || !input['text'].trim() || input['text'].trim().length > 1000) throw new CommentError(400, 'invalid_comment');
  return { idempotencyKey: input['idempotencyKey'], text: input['text'].trim() };
}

async function checked(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new CommentError(response.status === 409 ? 409 : 503, response.status === 409 ? 'comment_conflict' : 'firestore_unavailable');
  return await response.json() as Record<string, unknown>;
}

/** Writes a comment and its activity only after checking current membership and expense state. */
export async function createComment(value: unknown, uid: string, groupId: string, expenseId: string, env: CommentEnv, transport: typeof fetch = fetch): Promise<string> {
  if (![uid, groupId, expenseId].every(id => idPattern.test(id))) throw new CommentError(400, 'invalid_path');
  const comment = parseComment(value);
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const token = await serviceAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON, env.FIREBASE_PROJECT_ID, transport);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const begin = await checked(await transport(`https://firestore.googleapis.com/v1/${root}:beginTransaction`, { method: 'POST', headers, body: '{}' }));
  if (typeof begin['transaction'] !== 'string') throw new CommentError(503, 'transaction_unavailable');
  const transaction = begin['transaction'];
  let committed = false;
  try {
    const read = async (path: string) => {
      const response = await transport(`https://firestore.googleapis.com/v1/${root}/${path}?transaction=${encodeURIComponent(transaction)}`, { headers });
      if (response.status === 404) return null;
      return await checked(response);
    };
    if (field(await read(`groups/${groupId}`), 'status')?.stringValue !== 'active' ||
        field(await read(`groups/${groupId}/members/${uid}`), 'status')?.stringValue !== 'active') throw new CommentError(403, 'member_inactive');
    const expense = await read(`groups/${groupId}/expenses/${expenseId}`);
    if (!expense || field(expense, 'deleted')?.booleanValue === true) throw new CommentError(403, 'expense_unavailable');
    const commentPath = `groups/${groupId}/expenses/${expenseId}/comments/${comment.idempotencyKey}`;
    const previous = await read(commentPath);
    if (previous) {
      if (field(previous, 'authorId')?.stringValue === uid && field(previous, 'text')?.stringValue === comment.text) return comment.idempotencyKey;
      throw new CommentError(409, 'comment_conflict');
    }
    const now = new Date().toISOString();
    const activityPath = `groups/${groupId}/activity/comment_${comment.idempotencyKey}`;
    const create = (path: string, fields: Record<string, unknown>) => ({ update: { name: `${root}/${path}`, fields }, currentDocument: { exists: false } });
    const writes = [
      create(commentPath, { text: string(comment.text), authorId: string(uid), createdAt: { timestampValue: now } }),
      create(activityPath, { actorId: string(uid), action: string('comment_created'), expenseId: string(expenseId), commentId: string(comment.idempotencyKey), at: { timestampValue: now } }),
    ];
    await checked(await transport(`https://firestore.googleapis.com/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ transaction, writes }) }));
    committed = true;
    return comment.idempotencyKey;
  } finally {
    if (!committed) {
      try { await transport(`https://firestore.googleapis.com/v1/${root}:rollback`, { method: 'POST', headers, body: JSON.stringify({ transaction }) }); }
      catch { /* Preserve the original error. */ }
    }
  }
}
