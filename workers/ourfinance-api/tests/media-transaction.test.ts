import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { persistUploadedReceipt } from '../src/media';
import { recoverFailedUpload } from '../src/media-upload-journal';

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

test('un conflit avec la suppression compense le PNG sans publier de reçu', async () => {
  const operations: string[] = [];
  const transport = async (resource: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(resource);
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.includes('?transaction=')) {
      if (url.includes('/receiptUploadJobs/a')) return Response.json({ fields: {
        status: { stringValue: 'uploading' }, publicId: { stringValue: args[4] },
        ownerId: { stringValue: 'alice' }, expenseId: { stringValue: 'e' },
      } });
      if (url.includes('/expenses/e')) return Response.json({ fields: { deleted: { booleanValue: false } } });
      return Response.json({ fields: { status: { stringValue: 'active' } } });
    }
    if (url.endsWith(':commit')) {
      operations.push('conflict');
      return Response.json({}, { status: 409 });
    }
    if (url.endsWith(':rollback')) {
      operations.push('rollback');
      return Response.json({});
    }
    if (url.includes('updateMask.fieldPaths=status')) {
      operations.push('cleanup-pending');
      return Response.json({});
    }
    if (url.includes('/attachments/a')) {
      operations.push('attachment-absent');
      return Response.json({}, { status: 404 });
    }
    if (url.endsWith('/image/destroy')) {
      operations.push('asset-destroyed');
      return Response.json({ result: 'ok' });
    }
    if (url.endsWith('/receiptUploadJobs/a') && init?.method === 'DELETE') {
      operations.push('journal-removed');
      return Response.json({});
    }
    throw new Error('Requête inattendue');
  };
  const fetcher = transport as typeof fetch;
  await rejects(persistUploadedReceipt(...args, fetcher, 'groups/g/receiptUploadJobs/a'));
  const recovered = await recoverFailedUpload('g', 'e', 'a', args[4], args[6], {
    FIREBASE_PROJECT_ID: args[7], CLOUDINARY_CLOUD_NAME: 'synthetic',
    CLOUDINARY_API_KEY: 'dummy', CLOUDINARY_API_SECRET: 'dummy',
  }, fetcher);
  strictEqual(recovered, false);
  deepStrictEqual(operations, ['conflict', 'rollback', 'cleanup-pending', 'attachment-absent', 'asset-destroyed', 'journal-removed']);
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
