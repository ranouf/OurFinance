import assert from 'node:assert/strict';
import test from 'node:test';
import { ReceiptCleanupError, ReceiptCleanupService } from '../../src/app/core/firebase/receipt-cleanup-service';

const user = { getIdToken: async () => 'fictional-token' };
function service(status: number, body: object): ReceiptCleanupService {
  return new ReceiptCleanupService('https://ourfinance-api-dev.example.test', async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/groups/fictional-group/receipt-upload-jobs/cleanup');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fictional-token');
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
}

test('la reprise propriétaire distingue le nettoyage terminé et encore en attente', async () => {
  assert.deepEqual(await service(200, { cleaned: 1, pending: 0 }).run(user, 'fictional-group'), { status: 200, cleaned: 1, pending: 0 });
  assert.deepEqual(await service(202, { cleaned: 0, pending: 1 }).run(user, 'fictional-group'), { status: 202, cleaned: 0, pending: 1 });
});

test('le quota reste distinct du refus propriétaire et de la route indisponible', async () => {
  await assert.rejects(service(503, { error: 'provider_quota_exceeded' }).run(user, 'fictional-group'), (error: unknown) => error instanceof ReceiptCleanupError && error.code === 'quota');
  await assert.rejects(service(403, { error: 'forbidden' }).run(user, 'fictional-group'), (error: unknown) => error instanceof ReceiptCleanupError && error.code === 'denied');
  await assert.rejects(service(503, { error: 'Restauration non configurée' }).run(user, 'fictional-group'), (error: unknown) => error instanceof ReceiptCleanupError && error.code === 'unavailable');
});
