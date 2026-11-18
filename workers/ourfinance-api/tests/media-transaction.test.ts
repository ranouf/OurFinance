import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { persistUploadedReceipt } from '../src/media';

const args = ['g', 'e', 'a', 'alice', 'ourfinance-test/g/e/a', 'png', 'synthetic-token', 'ourfinance-test'] as const;

function fixture(options: { deleted?: boolean; revoked?: boolean; conflict?: boolean; journal?: boolean; cleanupPending?: boolean } = {}) {
  let commits = 0;
  let rollbacks = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.endsWith(':commit')) {
      commits++;
      const body = JSON.parse(String(init?.body));
      strictEqual(body.transaction, 'txn');
      strictEqual(body.writes[0].update.name.endsWith('/groups/g/expenses/e'), true);
      strictEqual(body.writes[0].updateMask.fieldPaths[0], 'receiptUpdatedAt');
      strictEqual(body.writes[1].update.fields.type.stringValue, 'authenticated');
      if (options.journal) strictEqual(body.writes[2].delete.endsWith('/groups/g/receiptUploadJobs/a'), true);
      return Response.json({}, { status: options.conflict ? 409 : 200 });
    }
    if (url.includes('/groups/g/members/alice?transaction=')) return Response.json({ fields: { status: { stringValue: options.revoked ? 'revoked' : 'active' } } });
    if (url.includes('/groups/g/expenses/e?transaction=')) return Response.json({ fields: { deleted: { booleanValue: options.deleted ?? false } } });
    if (url.includes('/groups/g/receiptUploadJobs/a?transaction=')) return Response.json({ fields: { status: { stringValue: options.cleanupPending ? 'cleanup_pending' : 'uploading' }, publicId: { stringValue: 'ourfinance-test/g/e/a' }, ownerId: { stringValue: 'alice' }, expenseId: { stringValue: 'e' } } });
    if (url.includes('/groups/g?transaction=')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    throw new Error('Requête inattendue');
  };
  return { transport: transport as typeof fetch, get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}

test('une transaction valide l’appartenance et la dépense avant de persister le reçu', async () => {
  const state = fixture();
  await persistUploadedReceipt(...args, state.transport);
  strictEqual(state.commits, 1);
  strictEqual(state.rollbacks, 0);
});

test('une dépense supprimée ou un membre révoqué pendant l’upload refuse la métadonnée', async () => {
  for (const options of [{ deleted: true }, { revoked: true }]) {
    const state = fixture(options);
    await rejects(persistUploadedReceipt(...args, state.transport));
    strictEqual(state.commits, 0);
    strictEqual(state.rollbacks, 1);
  }
});

test('un conflit transactionnel empêche de publier le reçu', async () => {
  const state = fixture({ conflict: true });
  await rejects(persistUploadedReceipt(...args, state.transport));
  strictEqual(state.commits, 1);
  strictEqual(state.rollbacks, 1);
});

test('activation et suppression du journal sont atomiques après vérification de la dépense', async () => {
  const state = fixture({ journal: true });
  await persistUploadedReceipt(...args, state.transport, 'groups/g/receiptUploadJobs/a');
  strictEqual(state.commits, 1);
  strictEqual(state.rollbacks, 0);
});

test('une reprise qui marque le journal avant la transaction empêche la publication', async () => {
  const state = fixture({ journal: true, cleanupPending: true });
  await rejects(persistUploadedReceipt(...args, state.transport, 'groups/g/receiptUploadJobs/a'));
  strictEqual(state.commits, 0);
  strictEqual(state.rollbacks, 1);
});

test('révocation ou suppression concurrente interdit l’activation malgré un journal', async () => {
  for (const options of [{ revoked: true }, { deleted: true }]) {
    const state = fixture({ ...options, journal: true });
    await rejects(persistUploadedReceipt(...args, state.transport, 'groups/g/receiptUploadJobs/a'));
    strictEqual(state.commits, 0);
    strictEqual(state.rollbacks, 1);
  }
});
