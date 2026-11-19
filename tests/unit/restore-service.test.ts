import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { RestoreService } from '../../src/app/features/import-export/restore-service';

test('restore service scopes preview, prepare, receipts, commit and cleanup to one authenticated group', async () => {
  const calls: { path: string; method: string; auth: string | null; type: string | null; bytes: number; cache: RequestCache | undefined }[] = [];
  const transport = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(input), method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('Authorization'),
      type: new Headers(init?.headers).get('Content-Type'), bytes: init?.body instanceof ArrayBuffer ? init.body.byteLength : 0, cache: init?.cache });
    return new Response(null, { status: 204 });
  };
  const service = new RestoreService('https://worker.example', transport as typeof fetch);
  const archive = new Uint8Array([1, 2, 3]);
  const user = { emailVerified: true, getIdToken: async () => 'fixture-token' };
  await service.preview(user, 'group-a', archive);
  await service.postArchive('fixture-token', 'group-a', 'restore-1', 'prepare', archive);
  await service.stageReceipt('fixture-token', 'group-a', 'restore-1', 0, 'image/png', new Uint8Array([4]));
  await service.postArchive('fixture-token', 'group-a', 'restore-1', 'commit', archive);
  await service.postArchive('fixture-token', 'group-a', 'restore-1', 'restore', archive);
  await service.cleanup('fixture-token', 'group-a', 'restore-1');
  await service.outcome('fixture-token', 'group-a', 'restore-1');
  await service.current('fixture-token', 'group-a');
  deepStrictEqual(calls.map(call => [call.path, call.method, call.auth, call.type, call.bytes, call.cache]), [
    ['https://worker.example/groups/group-a/backup/preview', 'POST', 'Bearer fixture-token', 'application/zip', 3, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/restore-1/prepare', 'POST', 'Bearer fixture-token', 'application/zip', 3, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/restore-1/receipts/0', 'POST', 'Bearer fixture-token', 'image/png', 1, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/restore-1/commit', 'POST', 'Bearer fixture-token', 'application/zip', 3, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/restore-1', 'POST', 'Bearer fixture-token', 'application/zip', 3, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/restore-1/cleanup', 'POST', 'Bearer fixture-token', null, 0, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/restore-1/outcome', 'GET', 'Bearer fixture-token', null, 0, 'no-store'],
    ['https://worker.example/groups/group-a/backup/restores/current', 'GET', 'Bearer fixture-token', null, 0, 'no-store'],
  ]);
  deepStrictEqual([...archive], [1, 2, 3]);
});

test('restore service rejects wrong identity, insecure transport, invalid ids and oversize before network', async () => {
  let calls = 0;
  const transport = async () => { calls++; return new Response(null, { status: 204 }); };
  const service = new RestoreService('https://worker.example', transport);
  const user = { emailVerified: true, getIdToken: async () => 'fixture-token' };
  await rejects(service.preview({ ...user, emailVerified: false }, 'group-a', new Uint8Array([1])), /email_unverified/);
  await rejects(service.preview(user, '../other', new Uint8Array([1])), /restore_id_invalid/);
  await rejects(service.postArchive('token', 'group-a', '../other', 'restore', new Uint8Array([1])), /restore_id_invalid/);
  await rejects(service.stageReceipt('token', 'group-a', 'restore-1', -1, 'image/png', new Uint8Array([1])), /restore_index_invalid/);
  await rejects(service.preview(user, 'group-a', new Uint8Array(20_000_001)), /archive_too_large/);
  strictEqual(calls, 0);
  const insecure = new RestoreService('http://worker.example', transport);
  await rejects(insecure.preview(user, 'group-a', new Uint8Array([1])), /insecure_url/);
  strictEqual(calls, 0);
});
