import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { readLimitedBody } from '../src/media';

const archiveLimit = 20_000_000;
const url = 'https://worker.example/groups/g/backup/restores/123e4567-e89b-42d3-a456-426614174000';

test('restore archive stream accepts exactly 20 MB', async () => {
  const bytes = new Uint8Array(archiveLimit);
  const request = new Request(url, { method: 'POST', body: bytes });
  strictEqual((await readLimitedBody(request, archiveLimit)).byteLength, archiveLimit);
});

test('restore archive stream rejects one byte over 20 MB despite a smaller declared length', async () => {
  const bytes = new Uint8Array(archiveLimit + 1);
  const request = new Request(url, { method: 'POST', headers: { 'Content-Length': '1' }, body: bytes });
  await rejects(readLimitedBody(request, archiveLimit), /Corps trop volumineux/);
});
