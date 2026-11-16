import assert from 'node:assert/strict';
import test from 'node:test';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { FxSettlementService, type FxSettlementRequest } from '../../src/app/core/firebase/fx-settlement-service';

const request: FxSettlementRequest = {
  idempotencyKey: 'd863d141-f287-441b-92c7-433eab6b6940', date: '2026-11-16',
  debtCurrency: 'CAD', debtAmountMinor: 51, paymentCurrency: 'JPY', paymentAmountMinor: 1,
  rate: '2', rateDate: '2026-11-16', fromUserId: 'member', toUserId: 'other',
};
const user = { emailVerified: true, getIdToken: async () => 'synthetic-token' } as User;

test('FX client submits the exact two-currency snapshot with a Firebase token', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), 'https://worker.example/groups/group/fx-settlements');
    assert.equal((init?.headers as Record<string, string>)['Authorization'], 'Bearer synthetic-token');
    assert.deepEqual(JSON.parse(String(init?.body)), request);
    return Response.json({ fxSettlementId: request.idempotencyKey }, { status: 201 });
  };
  try {
    const service = new FxSettlementService({} as FirebaseApp, 'https://worker.example');
    assert.equal(await service.create(user, 'group', request), request.idempotencyKey);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('FX client refuses unverified and insecure requests before transport', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Transport should not run'); };
  try {
    const service = new FxSettlementService({} as FirebaseApp, 'https://worker.example');
    await assert.rejects(service.create({ ...user, emailVerified: false } as User, 'group', request), /confirmée/);
    await assert.rejects(new FxSettlementService({} as FirebaseApp, 'http://worker.example').create(user, 'group', request), /non sécurisée/);
  } finally { globalThis.fetch = original; }
});
