import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreFailure } from '../../src/app/features/import-export/restore-failure';

function failure(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });
}

test('un quota fournisseur garde un message distinct pour les petites et grandes archives', async () => {
  assert.equal(await restoreFailure(failure(503, 'provider_quota_exceeded'), false), 'restoreQuota');
  assert.equal(await restoreFailure(failure(503, 'provider_quota_exceeded'), true), 'restorePreparedQuota');
  assert.equal(await restoreFailure(failure(503, 'provider_quota_exceeded'), false, true), 'restoreQuotaUncertain');
  assert.equal(await restoreFailure(failure(503, 'provider_quota_exceeded'), true, true), 'restorePreparedQuota');
});

test('une reprise réellement incertaine conserve son avertissement', async () => {
  assert.equal(await restoreFailure(failure(503, 'recovery_required'), false), 'restoreUncertain');
  assert.equal(await restoreFailure(failure(503, 'recovery_required'), true), 'restoreUncertain');
});

test('les autres refus restent distincts du quota', async () => {
  assert.equal(await restoreFailure(failure(503, 'group_creation_disabled'), false), 'restoreUnavailable');
  assert.equal(await restoreFailure(failure(400, 'invalid_archive'), false), 'restoreInvalid');
  assert.equal(await restoreFailure(failure(503, 'group_creation_disabled'), true), 'restorePreparedUncertain');
});
