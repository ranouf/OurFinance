import { test } from 'node:test';
import { deepStrictEqual, rejects } from 'node:assert';
import { readLimitedJson, RequestBodyError } from '../src/request-body';

test('JSON UTF-8 stream is parsed within the byte limit', async () => {
  const body = new TextEncoder().encode('{"description":"Épicerie fictive"}');
  const request = new Request('https://worker.example/groups/g/expenses', { method: 'POST', body });
  deepStrictEqual(await readLimitedJson(request, body.byteLength), { description: 'Épicerie fictive' });
});

test('forged or absent Content-Length cannot bypass the streamed byte limit', async () => {
  const body = new TextEncoder().encode('{"description":"éééééééééé"}');
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    const request = new Request('https://worker.example/groups/g/expenses', { method: 'POST', headers, body });
    await rejects(readLimitedJson(request, 20), error => error instanceof RequestBodyError && error.code === 'body_too_large');
  }
});

test('invalid JSON is distinguished from oversized input', async () => {
  const request = new Request('https://worker.example/groups/g/expenses', { method: 'POST', body: '{' });
  await rejects(readLimitedJson(request, 8192), error => error instanceof RequestBodyError && error.code === 'invalid_json');
});
