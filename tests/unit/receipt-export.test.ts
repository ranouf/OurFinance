import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import type { User } from 'firebase/auth';
import { downloadReceiptForExport } from '../../src/app/features/import-export/receipt-export';

const user = { emailVerified: true, getIdToken: async () => 'synthetic-token' } as Pick<User, 'emailVerified' | 'getIdToken'>;
const args = [user, 'https://worker.example', 'group_test', 'expense_1', 'receipt_1', 'png'] as const;
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64'));

test('downloads private bytes through Worker and reports a SHA-256 digest', async () => {
  let called = 0;
  const transport = (async (input: URL | RequestInfo, options?: RequestInit) => {
    called++;
    strictEqual(new URL(String(input)).pathname, '/groups/group_test/expenses/expense_1/attachments/receipt_1');
    strictEqual(new Headers(options?.headers).get('Authorization'), 'Bearer synthetic-token');
    strictEqual(options?.redirect, 'error');
    return new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } });
  }) as typeof fetch;
  const result = await downloadReceiptForExport(...args, transport);
  strictEqual(called, 1);
  strictEqual(result.filename, 'group_test/expense_1/receipt_1.png');
  strictEqual(result.byteLength, png.byteLength);
  strictEqual(result.sha256, '52332152ccab98cdb36d0c8872a8b1ede0d337fcb6c5b5ffb91eddf7f82c9f8f');
});

test('refuses unverified user, denied access, unexpected media and oversized stream', async () => {
  let called = 0;
  const denied = (async () => { called++; return new Response(null, { status: 403 }); }) as typeof fetch;
  await rejects(downloadReceiptForExport({ ...user, emailVerified: false }, ...args.slice(1), denied));
  await rejects(downloadReceiptForExport(user, 'http://worker.example', ...args.slice(2), denied));
  strictEqual(called, 0);
  await rejects(downloadReceiptForExport(...args, denied), /403/);
  const html = (async () => new Response('error page', { headers: { 'Content-Type': 'text/html' } })) as typeof fetch;
  await rejects(downloadReceiptForExport(...args, html), /invalide/);
  const spoofed = (async () => new Response('not an image', { headers: { 'Content-Type': 'image/png' } })) as typeof fetch;
  await rejects(downloadReceiptForExport(...args, spoofed), /invalide/);
  const oversized = (async () => new Response(new Uint8Array(2_000_001), { headers: { 'Content-Type': 'image/png' } })) as typeof fetch;
  await rejects(downloadReceiptForExport(...args, oversized), /volumineux/);
});
