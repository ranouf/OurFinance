import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { SettlementService, type SettlementRepository } from '../../src/app/core/firebase/settlement-service';
import { CommentService, type CommentRepository } from '../../src/app/core/firebase/comment-service';
import { ReceiptService, type ReceiptRepository } from '../../src/app/core/firebase/receipt-service';

const app = {} as FirebaseApp;
const user = { uid: 'alice', emailVerified: true, getIdToken: async () => 'fixture-token' } as User;
const row = (id: string, data: Record<string, unknown>) => ({ id, data: () => data }) as QueryDocumentSnapshot<DocumentData>;
const page = (docs: QueryDocumentSnapshot<DocumentData>[]) => ({ docs, size: docs.length }) as QuerySnapshot<DocumentData>;

test('settlements stay in the selected group and only active rows appear in history', async () => {
  const calls: string[] = [];
  const repository: SettlementRepository = { history: async (_app, groupId, after) => {
    calls.push(`${groupId}:${after?.id ?? ''}`);
    return page([row('old', { deleted: true }), row('new', { date: '2026-11-18', currency: 'CAD', amountMinor: 625,
      fromUserId: 'alice', toUserId: 'bob' })]);
  } };
  const requests: { path: string; body: unknown; auth: string | null }[] = [];
  const service = new SettlementService(app, 'https://worker.example', repository, async (url, init) => {
    requests.push({ path: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('Authorization') });
    return Response.json({ settlementId: 'settlement-1' });
  });
  const history = await service.history('group-a', row('cursor', {}));
  strictEqual(history.entries.length, 1);
  strictEqual(history.entries[0].amountMinor, 625);
  strictEqual(history.last?.id, 'new');
  deepStrictEqual(calls, ['group-a:cursor']);
  const request = { idempotencyKey: 'key', date: '2026-11-18', currency: 'CAD', amountMinor: 625,
    fromUserId: 'alice', toUserId: 'bob' };
  strictEqual(await service.create(user, 'group-a', request), 'settlement-1');
  deepStrictEqual(requests, [{ path: 'https://worker.example/groups/group-a/settlements', body: request, auth: 'Bearer fixture-token' }]);
});

test('settlement service refuses unverified identity, insecure Worker and malformed result', async () => {
  const repository: SettlementRepository = { history: async () => page([]) };
  const request = { idempotencyKey: 'key', date: '2026-11-18', currency: 'CAD', amountMinor: 1,
    fromUserId: 'alice', toUserId: 'bob' };
  const service = new SettlementService(app, 'https://worker.example', repository, async () => Response.json({}));
  await rejects(service.create({ ...user, emailVerified: false } as User, 'group-a', request), /courriel/);
  await rejects(service.create(user, 'group-a', request), /invalide/);
  const insecure = new SettlementService(app, 'http://worker.example', repository, async () => Response.json({ settlementId: 'x' }));
  await rejects(insecure.create(user, 'group-a', request), /sécurisée/);
});

test('comments are scoped to an expense, paginated and written through authenticated Worker', async () => {
  const calls: string[] = [];
  const repository: CommentRepository = { history: async (_app, groupId, expenseId, after) => {
    calls.push(`${groupId}:${expenseId}:${after?.id ?? ''}`);
    return page([row('comment-1', { authorId: 'alice', text: 'Merci', createdAt: 'time' })]);
  } };
  const requests: { path: string; body: unknown; auth: string | null }[] = [];
  const service = new CommentService(app, 'https://worker.example', repository, async (url, init) => {
    requests.push({ path: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('Authorization') });
    return new Response(null, { status: 201 });
  });
  const history = await service.history('group-a', 'expense-1', row('cursor', {}));
  deepStrictEqual(history.entries.map(item => [item.id, item.authorId, item.text]), [['comment-1', 'alice', 'Merci']]);
  deepStrictEqual(calls, ['group-a:expense-1:cursor']);
  await service.create(user, 'group-a', 'expense-1', 'Merci', 'key');
  deepStrictEqual(requests, [{ path: 'https://worker.example/groups/group-a/expenses/expense-1/comments',
    body: { text: 'Merci', idempotencyKey: 'key' }, auth: 'Bearer fixture-token' }]);
});

test('comments reject missing verification and disabled Worker without writing', async () => {
  let calls = 0;
  const repository: CommentRepository = { history: async () => page([]) };
  const service = new CommentService(app, 'https://worker.example', repository, async () => { calls++; return new Response(null, { status: 503 }); });
  await rejects(service.create({ ...user, emailVerified: false } as User, 'g', 'e', 'text', 'key'), /courriel/);
  strictEqual(calls, 0);
  await rejects(service.create(user, 'g', 'e', 'text', 'key'), /désactivés/);
});

test('receipts list only active metadata and keep bytes behind the authenticated proxy', async () => {
  const repository: ReceiptRepository = { list: async () => page([row('active', { status: 'active', format: 'png', ownerId: 'alice' }),
    row('removed', { status: 'removed', format: 'jpg', ownerId: 'bob' })]) };
  const requests: { path: string; method: string; auth: string | null }[] = [];
  const service = new ReceiptService(app, 'https://worker.example', repository, async (url, init) => {
    requests.push({ path: String(url), method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('Authorization') });
    return new Response(init?.method === 'GET' ? 'private-bytes' : null, { status: init?.method === 'POST' ? 201 : 200 });
  });
  deepStrictEqual(await service.list('group-a', 'expense-1'), [{ id: 'active', format: 'png', ownerId: 'alice' }]);
  await service.upload(user, 'group-a', 'expense-1', new File(['png'], 'receipt.png', { type: 'image/png' }));
  strictEqual(await (await service.read(user, 'group-a', 'expense-1', 'active')).text(), 'private-bytes');
  await service.remove(user, 'group-a', 'expense-1', 'active');
  deepStrictEqual(requests.map(item => [item.method, item.path, item.auth]), [
    ['POST', 'https://worker.example/groups/group-a/expenses/expense-1/attachments', 'Bearer fixture-token'],
    ['GET', 'https://worker.example/groups/group-a/expenses/expense-1/attachments/active', 'Bearer fixture-token'],
    ['DELETE', 'https://worker.example/groups/group-a/expenses/expense-1/attachments/active', 'Bearer fixture-token'],
  ]);
});

test('receipts refuse invalid files, unverified identity and insecure proxy before upload', async () => {
  let calls = 0;
  const repository: ReceiptRepository = { list: async () => page([]) };
  const transport = async () => { calls++; return new Response(null, { status: 201 }); };
  const service = new ReceiptService(app, 'https://worker.example', repository, transport);
  await rejects(service.upload(user, 'g', 'e', new File(['x'], 'x.txt', { type: 'text/plain' })), /PNG ou JPEG/);
  await rejects(service.upload({ ...user, emailVerified: false } as User, 'g', 'e', new File(['x'], 'x.png', { type: 'image/png' })), /courriel/);
  strictEqual(calls, 0);
  const insecure = new ReceiptService(app, 'http://worker.example', repository, transport);
  await rejects(insecure.read(user, 'g', 'e', 'a'), /sécurisée/);
});
