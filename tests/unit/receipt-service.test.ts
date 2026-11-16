import assert from 'node:assert/strict';
import test from 'node:test';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ReceiptService } from '../../src/app/core/firebase/receipt-service';

const user = { emailVerified: true, getIdToken: async () => 'fictional-token' } as User;
const service = new ReceiptService({} as FirebaseApp, 'https://example.test');

test('refuse une image invalide ou trop volumineuse avant la requête', async () => {
  await assert.rejects(service.upload(user, 'group', 'expense', new File(['texte'], 'test.txt', { type: 'text/plain' })), /PNG ou JPEG/);
  await assert.rejects(service.upload(user, 'group', 'expense', new File([new Uint8Array(2_000_001)], 'test.png', { type: 'image/png' })), /2 Mo/);
});

test('utilise seulement le proxy authentifié pour ajouter, lire et supprimer', async () => {
  const original = globalThis.fetch;
  const calls: { path: string; method: string; authorization: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: new URL(String(input)).pathname, method: init?.method ?? '', authorization: new Headers(init?.headers).get('Authorization') });
    return new Response(init?.method === 'GET' ? new Uint8Array([137, 80, 78, 71]) : null, { status: init?.method === 'POST' ? 201 : init?.method === 'DELETE' ? 204 : 200 });
  };
  try {
    await service.upload(user, 'group', 'expense', new File(['png'], 'test.png', { type: 'image/png' }));
    const image = await service.read(user, 'group', 'expense', 'receipt');
    assert.equal(image.size, 4);
    await service.remove(user, 'group', 'expense', 'receipt');
    assert.deepEqual(calls, [
      { path: '/groups/group/expenses/expense/attachments', method: 'POST', authorization: 'Bearer fictional-token' },
      { path: '/groups/group/expenses/expense/attachments/receipt', method: 'GET', authorization: 'Bearer fictional-token' },
      { path: '/groups/group/expenses/expense/attachments/receipt', method: 'DELETE', authorization: 'Bearer fictional-token' },
    ]);
  } finally { globalThis.fetch = original; }
});
