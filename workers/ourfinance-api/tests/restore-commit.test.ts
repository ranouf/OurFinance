import { test } from 'node:test';
import { rejects, strictEqual } from 'node:assert';
import { generateKeyPair, exportPKCS8 } from 'jose';
import type { GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { commitGroupRestoreV2, readRestoreOutcome, RestoreCommitError } from '../src/restore-commit';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';
const backup: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, snapshotMode: 'server_transaction', exportedAt: '2026-11-16T18:00:00.000Z',
  group: { id: 'g', name: 'Fictif', currency: 'CAD' },
  members: [{ userId: 'alice', role: 'owner', status: 'active' }],
  expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [],
  expenseAuthors: [], receiptOwners: [], receiptAssets: [], comments: [], activity: [], importBatches: [],
  preferences: [{ userId: 'alice', modeJson: null, memberIds: [], updatedAt: null }],
};
const live = { groupDocuments: ['groups/g', 'groups/g/members/alice'], userDocuments: ['users/alice/groupMemberships/g'], receiptPublicIds: [] };

async function fixture(memberStatus = 'active', committed = false) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  let commits = 0;
  let rollbacks = 0;
  const transport = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'synthetic-service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':rollback')) { rollbacks++; return Response.json({}); }
    if (url.includes('/groups/g/members/alice')) return Response.json({ fields: { role: { stringValue: 'owner' }, status: { stringValue: memberStatus } } });
    if (url.includes(`/groups/g/restoreJobs/${restoreId}?`)) return Response.json({ fields: { ownerId: { stringValue: 'alice' }, status: { stringValue: 'staging' }, newPublicIds: { arrayValue: { values: [] } } } });
    if (url.endsWith('/groups/g') || url.includes('/groups/g?')) return Response.json({ fields: {
      status: { stringValue: committed ? 'active' : 'restoring' },
      ...(committed ? { lastRestoreId: { stringValue: restoreId } } : { restoreId: { stringValue: restoreId }, restoreOwnerId: { stringValue: 'alice' } }),
      ownerId: { stringValue: 'alice' }, currencyCode: { stringValue: 'CAD' },
    } });
    if (url.endsWith(':commit')) {
      commits++;
      const body = JSON.parse(String(init?.body));
      strictEqual(body.writes.some((row: { update?: { fields?: { status?: { stringValue?: string } } } }) => row.update?.fields?.status?.stringValue === 'active'), true);
      return Response.json({});
    }
    throw new Error('Requête inattendue');
  };
  return { env, transport: transport as typeof fetch, get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}

test('locked owner commits the replacement and releases the group atomically', async () => {
  const state = await fixture();
  await commitGroupRestoreV2('alice', 'g', restoreId, backup, live, [], state.env, state.transport);
  strictEqual(state.commits, 1);
  strictEqual(state.rollbacks, 0);
});

test('changed member status prevents every replacement write and rolls back', async () => {
  const state = await fixture('revoked');
  await rejects(commitGroupRestoreV2('alice', 'g', restoreId, backup, live, [], state.env, state.transport),
    (error: unknown) => error instanceof RestoreCommitError && error.code === 'members_changed');
  strictEqual(state.commits, 0);
  strictEqual(state.rollbacks, 1);
});

test('lost response is resolved only by the durable lastRestoreId marker', async () => {
  const pending = await fixture();
  strictEqual(await readRestoreOutcome('alice', 'g', restoreId, pending.env, pending.transport), 'locked');
  const completed = await fixture('active', true);
  strictEqual(await readRestoreOutcome('alice', 'g', restoreId, completed.env, completed.transport), 'committed');
  await rejects(readRestoreOutcome('alice', 'g', '223e4567-e89b-42d3-a456-426614174000', completed.env, completed.transport));
});

test('outcome lookup refuses a revoked owner before returning the restore state', async () => {
  const state = await fixture('revoked', true);
  await rejects(readRestoreOutcome('alice', 'g', restoreId, state.env, state.transport),
    (error: unknown) => error instanceof RestoreCommitError && error.status === 403 && error.code === 'owner_required');
});

test('outcome lookup refuses a missing group or membership without exposing restore state', async () => {
  for (const path of ['/groups/g', '/groups/g/members/alice']) {
    const state = await fixture();
    const transport = (async (resource: string | URL | Request, init?: RequestInit) =>
      String(resource).endsWith(path) ? new Response(null, { status: 404 }) : state.transport(resource, init)) as typeof fetch;
    await rejects(readRestoreOutcome('alice', 'g', restoreId, state.env, transport),
      (error: unknown) => error instanceof RestoreCommitError && error.status === 403 && error.code === 'owner_required');
  }
});

test('quota during either outcome read keeps the fixed public quota signal', async () => {
  for (const path of ['/groups/g', '/groups/g/members/alice']) {
    const state = await fixture();
    const transport = (async (resource: string | URL | Request, init?: RequestInit) =>
      String(resource).endsWith(path) ? new Response(null, { status: 429 }) : state.transport(resource, init)) as typeof fetch;
    await rejects(readRestoreOutcome('alice', 'g', restoreId, state.env, transport),
      (error: unknown) => error instanceof RestoreCommitError && error.status === 503 && error.code === 'provider_quota_exceeded');
  }
});

test('non-quota outcome read failure keeps the generic unavailable signal', async () => {
  const state = await fixture();
  const transport = (async (resource: string | URL | Request, init?: RequestInit) =>
    String(resource).endsWith('/groups/g') ? new Response(null, { status: 503 }) : state.transport(resource, init)) as typeof fetch;
  await rejects(readRestoreOutcome('alice', 'g', restoreId, state.env, transport),
    (error: unknown) => error instanceof RestoreCommitError && error.status === 503 && error.code === 'outcome_unavailable');
});
