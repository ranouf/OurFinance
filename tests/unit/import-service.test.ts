import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import type { User } from 'firebase/auth';
import { ImportNotConfiguredError, ImportService } from '../../src/app/features/import-export/import-service';

const batchId = '01234567-89ab-4def-8abc-0123456789ab';
const user = { emailVerified: true, getIdToken: async () => 'synthetic-token' } as Pick<User, 'emailVerified' | 'getIdToken'>;
const batch = { groupId: 'test_group', body: { batchId, records: [{ sourceId: 'synthetic-1', date: '2026-10-01', description: 'Fictif', currency: 'CAD', amountMinor: 100, netImpactsMinor: { member_a: 100, member_b: -100 } }] } };

test('posts a mapped batch and undoes it with a Firebase ID token', async () => {
  const requests: { path: string; method: string; auth: string | null; body: string | undefined }[] = [];
  const transport = (async (input: URL | RequestInfo, options?: RequestInit) => {
    requests.push({ path: new URL(String(input)).pathname, method: options?.method ?? '', auth: new Headers(options?.headers).get('Authorization'), body: options?.body?.toString() });
    return options?.method === 'POST' ? Response.json({ batchId, recordCount: 1 }, { status: 201 }) : new Response(null, { status: 204 });
  }) as typeof fetch;
  const service = new ImportService('https://worker.example', transport);
  strictEqual(await service.create(user, batch), batchId);
  await service.undo(user, batch.groupId, batchId);
  deepStrictEqual(requests.map(item => [item.path, item.method, item.auth]), [
    ['/groups/test_group/imports', 'POST', 'Bearer synthetic-token'],
    [`/groups/test_group/imports/${batchId}`, 'DELETE', 'Bearer synthetic-token'],
  ]);
  strictEqual(JSON.parse(requests[0].body ?? '{}').records[0].sourceId, 'synthetic-1');
  strictEqual(requests[1].body, undefined);
});

test('blocks unverified users and insecure Worker URLs before transport', async () => {
  let calls = 0;
  const transport = (async () => { calls++; return new Response(null, { status: 204 }); }) as typeof fetch;
  await rejects(new ImportService('https://worker.example', transport).create({ ...user, emailVerified: false }, batch));
  await rejects(new ImportService('http://worker.example', transport).create(user, batch));
  await rejects(new ImportService('https://worker.example', transport).undo(user, 'bad/group', batchId));
  strictEqual(calls, 0);
});

test('surfaces disabled routes and rejects malformed success responses', async () => {
  const disabled = new ImportService('https://worker.example', async () => Response.json({ error: 'Import non configuré' }, { status: 503 }));
  await rejects(disabled.create(user, batch), ImportNotConfiguredError);
  const unavailable = new ImportService('https://worker.example', async () => new Response(null, { status: 503 }));
  await rejects(unavailable.create(user, batch), /Import refusé \(HTTP 503\)/);
  await rejects(new ImportService('https://worker.example', (async () => Response.json({ batchId, recordCount: 0 }, { status: 201 })) as typeof fetch).create(user, batch), /invalide/);
});
