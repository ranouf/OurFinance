import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { handleMedia, handleMediaCleanup, type MediaEnv } from '../src/media';
import { ProviderQuotaError } from '../src/provider-quota';

const headers = () => new Headers();
const auth = async () => 'alice';
const ids = { groupId: 'g', expenseId: 'e', attachmentId: 'a' };
const baseEnv: MediaEnv = {
  FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
  CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret',
};
const request = (method: string, path = '/groups/g/expenses/e/attachments/a') =>
  new Request(`https://worker.example${path}`, { method, headers: { Authorization: 'Bearer fixture-token' } });

function transportFixture(options: { role?: string; memberStatus?: string; memberHttp?: number; expenseHttp?: number;
  deleted?: boolean; attachmentHttp?: number; attachmentStatus?: string; attachmentType?: string;
  ownerId?: string; publicId?: string; format?: string; cloudinaryHttp?: number } = {}) {
  const calls: string[] = [];
  const transport = (async (resource: string | URL | Request) => {
    const url = String(resource);
    calls.push(url);
    if (url.includes('/members/alice')) return options.memberHttp
      ? Response.json({}, { status: options.memberHttp })
      : Response.json({ fields: { role: { stringValue: options.role ?? 'owner' }, status: { stringValue: options.memberStatus ?? 'active' } } });
    if (url.includes('/attachments/a')) return options.attachmentHttp
      ? Response.json({}, { status: options.attachmentHttp })
      : Response.json({ fields: { type: { stringValue: options.attachmentType ?? 'authenticated' },
        status: { stringValue: options.attachmentStatus ?? 'active' }, ownerId: { stringValue: options.ownerId ?? 'alice' },
        publicId: { stringValue: options.publicId ?? 'ourfinance-test/g/e/a' }, format: { stringValue: options.format ?? 'png' } } });
    if (url.includes('/expenses/e')) return options.expenseHttp
      ? Response.json({}, { status: options.expenseHttp })
      : Response.json({ fields: { deleted: { booleanValue: options.deleted ?? false } } });
    if (url.includes('api.cloudinary.com')) return new Response(new Uint8Array([137, 80, 78, 71]), { status: options.cloudinaryHttp ?? 200 });
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  return { transport, calls };
}

test('media route rejects invalid path, absent token and invalid identity before private reads', async () => {
  const f = transportFixture();
  strictEqual((await handleMedia(request('GET'), { ...ids, groupId: 'bad/group' }, baseEnv, headers(), f.transport, auth)).status, 400);
  strictEqual((await handleMedia(new Request('https://worker.example'), ids, baseEnv, headers(), f.transport, auth)).status, 401);
  strictEqual((await handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, async () => { throw new Error('invalid'); })).status, 401);
  strictEqual(f.calls.length, 0);
});

test('membership and expense checks protect all media methods', async () => {
  for (const options of [{ memberHttp: 404 }, { memberStatus: 'revoked' }]) {
    const f = transportFixture(options);
    strictEqual((await handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, auth)).status, 403);
    strictEqual(f.calls.length, 1);
  }
  for (const options of [{ expenseHttp: 404 }, { deleted: true }]) {
    const f = transportFixture(options);
    strictEqual((await handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, auth)).status, 404);
    strictEqual(f.calls.length, 2);
  }
  for (const [options, stage] of [[{ memberHttp: 500 }, 'member_read'], [{ expenseHttp: 500 }, 'expense_read']] as const) {
    const f = transportFixture(options);
    await rejects(handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, auth),
      (error: unknown) => error instanceof Error && error.message === stage);
  }
  const quota = transportFixture({ memberHttp: 429 });
  await rejects(handleMedia(request('GET'), ids, baseEnv, headers(), quota.transport, auth), ProviderQuotaError);
});

test('upload rejects absent, oversized and invalid image before journal creation', async () => {
  for (const [body, extra, expected] of [
    [undefined, {}, 413],
    [new Uint8Array([1, 2, 3]), {}, 400],
    [new Uint8Array([1]), { 'Content-Length': '2000001' }, 413],
  ] as const) {
    const f = transportFixture();
    const upload = new Request('https://worker.example/groups/g/expenses/e/attachments', {
      method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'image/png', ...extra }, body,
    });
    strictEqual((await handleMedia(upload, { groupId: 'g', expenseId: 'e' }, baseEnv, headers(), f.transport, auth)).status, expected);
    strictEqual(f.calls.length, 2);
  }
});

test('metadata, ownership and media format checks protect download and deletion', async () => {
  for (const options of [{ attachmentHttp: 404 }, { attachmentType: 'upload' }, { attachmentStatus: 'deleted' }]) {
    const f = transportFixture(options);
    strictEqual((await handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, auth)).status, 404);
  }
  for (const options of [{ publicId: 'ourfinance-test/other/e/a' }, { format: 'gif' }]) {
    const f = transportFixture(options);
    strictEqual((await handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, auth)).status, 500);
  }
  const member = transportFixture({ role: 'member', ownerId: 'bob' });
  strictEqual((await handleMedia(request('DELETE'), ids, baseEnv, headers(), member.transport, auth)).status, 403);
  const missing = transportFixture({ attachmentHttp: 500 });
  await rejects(handleMedia(request('GET'), ids, baseEnv, headers(), missing.transport, auth), /metadata_read/);
});

test('authenticated download streams PNG without exposing a signed URL', async () => {
  const f = transportFixture();
  const response = await handleMedia(request('GET'), ids, baseEnv, headers(), f.transport, auth);
  strictEqual(response.status, 200);
  strictEqual(response.headers.get('Content-Type'), 'image/png');
  strictEqual(response.headers.get('X-Content-Type-Options'), 'nosniff');
  strictEqual(f.calls.some(url => url.includes('api.cloudinary.com')), true);
  const failed = transportFixture({ cloudinaryHttp: 503 });
  strictEqual((await handleMedia(request('GET'), ids, baseEnv, headers(), failed.transport, auth)).status, 502);
  const limited = transportFixture({ cloudinaryHttp: 429 });
  await rejects(handleMedia(request('GET'), ids, baseEnv, headers(), limited.transport, auth), ProviderQuotaError);
});

test('cleanup route is owner only and returns empty result without journals', async () => {
  strictEqual((await handleMediaCleanup(request('POST'), 'bad/group', baseEnv, headers(), transportFixture().transport, auth)).status, 400);
  strictEqual((await handleMediaCleanup(new Request('https://worker.example'), 'g', baseEnv, headers(), transportFixture().transport, auth)).status, 401);
  const member = transportFixture({ role: 'member' });
  strictEqual((await handleMediaCleanup(request('POST'), 'g', baseEnv, headers(), member.transport, auth)).status, 403);
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { ...baseEnv, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test',
    client_email: 'fixture@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const transport = (async (resource: string | URL | Request) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.includes('/receiptUploadJobs?')) return Response.json({ documents: [] });
    return transportFixture().transport(resource);
  }) as typeof fetch;
  const response = await handleMediaCleanup(request('POST'), 'g', env, headers(), transport, auth);
  strictEqual(response.status, 200);
  strictEqual((await response.json() as { cleaned: number }).cleaned, 0);
});

test('valid PNG upload journals before Cloudinary and activates receipt atomically', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { ...baseEnv, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test',
    client_email: 'fixture@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const operations: string[] = [];
  let publicId = '';
  const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.includes('/members/alice') && !url.includes('?transaction=')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    if (url.endsWith('/groups/g/expenses/e')) return Response.json({ fields: { deleted: { booleanValue: false } } });
    if (url.endsWith(':beginTransaction')) { operations.push('begin'); return Response.json({ transaction: 'txn' }); }
    if (url.includes('?transaction=')) {
      if (url.includes('/receiptUploadJobs/')) return Response.json({ fields: { status: { stringValue: 'uploading' }, publicId: { stringValue: publicId }, ownerId: { stringValue: 'alice' }, expenseId: { stringValue: 'e' } } });
      if (url.includes('/expenses/e')) return Response.json({ fields: { deleted: { booleanValue: false } } });
      return Response.json({ fields: { status: { stringValue: 'active' } } });
    }
    if (url.endsWith(':commit')) {
      const writes = (JSON.parse(String(init?.body)) as { writes: Array<{ update?: { fields?: { publicId?: { stringValue: string } } } }> }).writes;
      if (!operations.includes('journal')) { operations.push('journal'); publicId = writes[0].update?.fields?.publicId?.stringValue ?? ''; }
      else { operations.push('activate'); strictEqual(writes.length, 3); }
      return Response.json({});
    }
    if (url.endsWith('/image/upload')) {
      operations.push('cloudinary');
      const form = init?.body as FormData;
      strictEqual(form.get('public_id'), publicId);
      return Response.json({ public_id: publicId, type: 'authenticated', resource_type: 'image', format: 'png' });
    }
    throw new Error(`Unexpected ${url}`);
  }) as typeof fetch;
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
  const upload = new Request('https://worker.example/groups/g/expenses/e/attachments', {
    method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'image/png' }, body: png,
  });
  const response = await handleMedia(upload, { groupId: 'g', expenseId: 'e' }, env, headers(), transport, auth);
  strictEqual(response.status, 201);
  strictEqual(publicId.endsWith(`/${(await response.json() as { attachmentId: string }).attachmentId}`), true);
  strictEqual(operations.join(','), 'journal,cloudinary,begin,activate');
});

test('owner retries deletion of an already hidden receipt without repeating logical delete', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { ...baseEnv, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test',
    client_email: 'fixture@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  const operations: string[] = [];
  const transport = (async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.includes('/members/alice')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: 'active' } } });
    if (url.endsWith('/attachments/a')) return Response.json({ fields: { type: { stringValue: 'authenticated' }, status: { stringValue: 'deleted' },
      cleanupPending: { booleanValue: true }, ownerId: { stringValue: 'bob' }, publicId: { stringValue: 'ourfinance-test/g/e/a' }, format: { stringValue: 'png' } } });
    if (url.endsWith('/expenses/e')) return Response.json({ fields: { deleted: { booleanValue: false } } });
    if (url.endsWith('/image/destroy')) { operations.push('destroy'); return Response.json({ result: 'ok' }); }
    if (url.includes('updateMask.fieldPaths=cleanupPending')) { operations.push('clear'); strictEqual(init?.method, 'PATCH'); return Response.json({}); }
    if (url.endsWith(':commit')) { operations.push('logical-delete'); return Response.json({}); }
    throw new Error(`Unexpected ${url}`);
  }) as typeof fetch;
  const response = await handleMedia(request('DELETE'), ids, env, headers(), transport, auth);
  strictEqual(response.status, 204);
  strictEqual(operations.join(','), 'destroy,clear');
});
