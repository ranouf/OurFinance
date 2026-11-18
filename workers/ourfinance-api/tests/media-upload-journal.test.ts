import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { cleanupUploadJournals, createUploadJournal, recoverFailedUpload } from '../src/media-upload-journal';
import { ProviderQuotaError } from '../src/provider-quota';

const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: 'dummy', CLOUDINARY_API_SECRET: 'dummy' };
const publicId = 'ourfinance-test/g/e/a';
const journalName = 'projects/ourfinance-test/databases/(default)/documents/groups/g/receiptUploadJobs/a';

test('journal is written before any remote asset request and stays outside attachments', async () => {
  const requests: string[] = [];
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    requests.push(String(resource));
    const body = JSON.parse(String(init?.body));
    const write = body.writes[0];
    strictEqual(write.update.name, journalName);
    strictEqual(write.update.fields.publicId.stringValue, publicId);
    strictEqual(write.update.fields.status.stringValue, 'uploading');
    deepStrictEqual(write.currentDocument, { exists: false });
    return Response.json({});
  };
  await createUploadJournal('g', 'e', 'a', 'alice', publicId, 'png', 'token', env, transport as typeof fetch);
  strictEqual(requests.length, 1);
  strictEqual(requests[0].endsWith(':commit'), true);
});

test('failed metadata commit marks cleanup before deleting the private asset', async () => {
  const operations: string[] = [];
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('updateMask.fieldPaths=status')) { operations.push('mark'); return Response.json({}); }
    if (url.includes('/attachments/a')) { operations.push('read'); return Response.json({}, { status: 404 }); }
    if (url.endsWith('/image/destroy')) { operations.push('destroy'); return Response.json({ result: 'ok' }); }
    if (url.endsWith('/receiptUploadJobs/a') && init?.method === 'DELETE') { operations.push('remove'); return Response.json({}); }
    throw new Error(`Unexpected request ${url}`);
  };
  strictEqual(await recoverFailedUpload('g', 'e', 'a', publicId, 'token', env, transport as typeof fetch), false);
  deepStrictEqual(operations, ['mark', 'read', 'destroy', 'remove']);
});

test('an ambiguous successful commit preserves its active receipt', async () => {
  const operations: string[] = [];
  const transport = async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('updateMask.fieldPaths=status')) { operations.push('mark-missing'); return Response.json({}, { status: 404 }); }
    if (url.includes('/attachments/a')) { operations.push('read-active'); return Response.json({ fields: { publicId: { stringValue: publicId }, type: { stringValue: 'authenticated' } } }); }
    throw new Error(`Unexpected request ${url}`);
  };
  strictEqual(await recoverFailedUpload('g', 'e', 'a', publicId, 'token', env, transport as typeof fetch), true);
  deepStrictEqual(operations, ['mark-missing', 'read-active']);
});

test('double failure leaves durable cleanup pending and owner retry is idempotent', async () => {
  let destroyFails = true;
  let removed = false;
  const operations: string[] = [];
  const job = { name: journalName, fields: { expenseId: { stringValue: 'e' }, publicId: { stringValue: publicId }, status: { stringValue: 'cleanup_pending' }, createdAt: { timestampValue: '2026-01-01T00:00:00.000Z' } } };
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('updateMask.fieldPaths=status')) { operations.push('mark'); return Response.json({}); }
    if (url.includes('/attachments/a')) { operations.push('read'); return Response.json({}, { status: 404 }); }
    if (url.endsWith('/image/destroy')) { operations.push('destroy'); return destroyFails ? Response.json({}, { status: 503 }) : Response.json({ result: 'not found' }); }
    if (url.includes('/receiptUploadJobs?pageSize=9')) { operations.push('list'); return Response.json({ documents: removed ? [] : [job] }); }
    if (url.endsWith('/receiptUploadJobs/a') && init?.method === 'DELETE') { operations.push('remove'); removed = true; return Response.json({}); }
    throw new Error(`Unexpected request ${url}`);
  };
  await rejects(recoverFailedUpload('g', 'e', 'a', publicId, 'token', env, transport as typeof fetch));
  deepStrictEqual(operations, ['mark', 'read', 'destroy']);
  destroyFails = false;
  deepStrictEqual(await cleanupUploadJournals('g', 'token', env, transport as typeof fetch), { cleaned: 1, pending: 0 });
  deepStrictEqual(operations.slice(3), ['list', 'read', 'destroy', 'remove']);
  deepStrictEqual(await cleanupUploadJournals('g', 'token', env, transport as typeof fetch), { cleaned: 0, pending: 0 });
  strictEqual(operations.filter(item => item === 'destroy').length, 2);
});

test('owner retry leaves an in-flight upload untouched and rejects cross-group asset IDs', async () => {
  let destroyed = false;
  const row = { name: journalName, fields: { expenseId: { stringValue: 'e' }, publicId: { stringValue: publicId }, status: { stringValue: 'uploading' }, createdAt: { timestampValue: '2026-01-01T00:00:00.000Z' } } };
  const transport = async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('/receiptUploadJobs?pageSize=9')) return Response.json({ documents: [row] });
    if (url.endsWith('/image/destroy')) destroyed = true;
    throw new Error(`Unexpected request ${url}`);
  };
  deepStrictEqual(await cleanupUploadJournals('g', 'token', env, transport as typeof fetch, Date.parse('2026-01-01T00:01:00Z')), { cleaned: 0, pending: 1 });
  strictEqual(destroyed, false);
  row.fields.publicId.stringValue = 'ourfinance-test/other/e/a';
  await rejects(cleanupUploadJournals('g', 'token', env, transport as typeof fetch, Date.parse('2026-01-02T00:00:00Z')));
  strictEqual(destroyed, false);
});

test('owner retry caps one request at eight assets for the Worker subrequest budget', async () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({
    name: `${journalName.slice(0, -1)}${index}`,
    fields: { expenseId: { stringValue: 'e' }, publicId: { stringValue: `ourfinance-test/g/e/${index}` }, status: { stringValue: 'cleanup_pending' }, createdAt: { timestampValue: '2026-01-01T00:00:00.000Z' } },
  }));
  let destroys = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('/receiptUploadJobs?pageSize=9')) return Response.json({ documents: rows });
    if (url.includes('/attachments/')) return Response.json({}, { status: 404 });
    if (url.endsWith('/image/destroy')) { destroys++; return Response.json({ result: 'ok' }); }
    if (url.includes('/receiptUploadJobs/') && init?.method === 'DELETE') return Response.json({});
    throw new Error(`Unexpected request ${url}`);
  };
  deepStrictEqual(await cleanupUploadJournals('g', 'token', env, transport as typeof fetch), { cleaned: 8, pending: 1 });
  strictEqual(destroys, 8);
});

test('owner retry reports a provider quota and preserves the journal until recovery', async () => {
  for (const quotaAt of ['attachment', 'destroy'] as const) {
    let quota = true;
    let removed = false;
    let destroyAttempts = 0;
    const row = { name: journalName, fields: {
      expenseId: { stringValue: 'e' }, publicId: { stringValue: publicId },
      status: { stringValue: 'cleanup_pending' }, createdAt: { timestampValue: '2026-01-01T00:00:00.000Z' },
    } };
    const transport = async (resource: string | URL | Request, init?: RequestInit) => {
      const url = String(resource);
      if (url.includes('/receiptUploadJobs?pageSize=9')) return Response.json({ documents: removed ? [] : [row] });
      if (url.endsWith('/attachments/a')) return quota && quotaAt === 'attachment'
        ? Response.json({}, { status: 429 }) : Response.json({}, { status: 404 });
      if (url.endsWith('/image/destroy')) {
        destroyAttempts++;
        return quota && quotaAt === 'destroy' ? Response.json({}, { status: 429 }) : Response.json({ result: 'ok' });
      }
      if (url.endsWith('/receiptUploadJobs/a') && init?.method === 'DELETE') { removed = true; return Response.json({}); }
      throw new Error(`Unexpected request ${url}`);
    };
    await rejects(cleanupUploadJournals('g', 'token', env, transport as typeof fetch), ProviderQuotaError);
    strictEqual(removed, false);
    quota = false;
    deepStrictEqual(await cleanupUploadJournals('g', 'token', env, transport as typeof fetch), { cleaned: 1, pending: 0 });
    strictEqual(removed, true);
    strictEqual(destroyAttempts, quotaAt === 'destroy' ? 2 : 1);
  }
});
