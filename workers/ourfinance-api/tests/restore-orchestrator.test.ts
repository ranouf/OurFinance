import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { sha256Hex } from '../../../src/app/features/import-export/backup-package';
import type { BackupPackageV2 } from '../../../src/app/features/import-export/backup-package-v2';
import { serializeGroupExportV2, type GroupExportV2 } from '../../../src/app/features/import-export/export-v2';
import { restoreGroupFromPackage, RestoreOrchestrationError, type RestoreOperations } from '../src/restore-orchestrator';

const restoreId = '123e4567-e89b-42d3-a456-426614174000';
const at = '2026-11-16T18:00:00.000Z';
const group: GroupExportV2 = {
  format: 'OurFinanceGroupExport', version: 2, snapshotMode: 'server_transaction', exportedAt: at,
  group: { id: 'g', name: 'Fictif', currency: 'CAD' }, members: [{ userId: 'alice', role: 'owner', status: 'active' }],
  expenses: [], settlements: [], importedRecords: [], categories: [], receipts: [], expenseAuthors: [], receiptOwners: [], receiptAssets: [],
  comments: [], activity: [], importBatches: [], preferences: [{ userId: 'alice', modeJson: null, memberIds: [], updatedAt: null }],
};
const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: 'unused',
  CLOUDINARY_CLOUD_NAME: 'unused', CLOUDINARY_API_KEY: 'unused', CLOUDINARY_API_SECRET: 'unused' };

async function archive(): Promise<BackupPackageV2> {
  const groupJson = serializeGroupExportV2(group);
  const bytes = new TextEncoder().encode(groupJson);
  return { groupJson, receipts: [], manifest: { format: 'OurFinanceBackupManifest', version: 2, scope: 'group-v2-partial',
    groupId: 'g', exportedAt: at, groupJson: { filename: 'group.json', sha256: await sha256Hex(bytes), byteLength: bytes.length }, receipts: [] } };
}

function operations(events: string[], outcome: 'committed' | 'locked' = 'locked'): RestoreOperations {
  return {
    begin: async () => { events.push('begin'); }, abort: async () => { events.push('abort'); },
    stage: async () => { events.push('stage'); return []; },
    inventory: async () => { events.push('inventory'); return { groupDocuments: ['groups/g'], userDocuments: [], receiptPublicIds: [] }; },
    commit: async () => { events.push('commit'); return []; },
    outcome: async () => { events.push('outcome'); return outcome; },
    cleanup: async () => { events.push('cleanup'); return 0; },
  };
}

test('verified archive follows lock, stage, inventory, commit and cleanup', async () => {
  const events: string[] = [];
  const result = await restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, operations(events));
  deepStrictEqual(events, ['begin', 'stage', 'inventory', 'commit', 'cleanup']);
  strictEqual(result.cleanupPending, false);
});

test('client partial snapshot cannot start a restore lock', async () => {
  const events: string[] = [];
  const source = await archive();
  const groupJson = serializeGroupExportV2({ ...group, snapshotMode: 'client_partial' });
  const bytes = new TextEncoder().encode(groupJson);
  const partial = { ...source, groupJson, manifest: { ...source.manifest,
    groupJson: { ...source.manifest.groupJson, sha256: await sha256Hex(bytes), byteLength: bytes.length } } };
  await rejects(restoreGroupFromPackage('alice', 'g', restoreId, partial, env, fetch, operations(events)),
    (error: unknown) => error instanceof RestoreOrchestrationError && error.code === 'invalid_backup');
  deepStrictEqual(events, []);
});

test('failed commit with confirmed lock aborts and cleans staged assets', async () => {
  const events: string[] = [];
  const ops = operations(events);
  ops.commit = async () => { events.push('commit'); throw new Error('conflict'); };
  await rejects(restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops));
  deepStrictEqual(events, ['begin', 'stage', 'inventory', 'commit', 'outcome', 'abort', 'cleanup']);
});

test('uncertain commit outcome preserves lock for recovery', async () => {
  const events: string[] = [];
  const ops = operations(events);
  ops.commit = async () => { events.push('commit'); throw new Error('network'); };
  ops.outcome = async () => { events.push('outcome'); throw new Error('network'); };
  await rejects(restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops),
    (error: unknown) => error instanceof RestoreOrchestrationError && error.code === 'recovery_required');
  strictEqual(events.includes('abort'), false);
});

test('post-commit media cleanup failure is reported as retryable', async () => {
  const events: string[] = [];
  const ops = operations(events);
  ops.cleanup = async () => { events.push('cleanup'); throw new Error('cloudinary'); };
  const result = await restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops);
  strictEqual(result.cleanupPending, true);
});

test('media staging failure aborts the lock and retries asset cleanup', async () => {
  const events: string[] = [];
  const ops = operations(events);
  ops.stage = async () => { events.push('stage'); throw new Error('cloudinary'); };
  await rejects(restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops),
    (error: unknown) => error instanceof RestoreOrchestrationError && error.code === 'restore_failed' && error.stage === 'media');
  deepStrictEqual(events, ['begin', 'stage', 'abort', 'cleanup']);
});

test('failed rollback reports only the safe recovery stage', async () => {
  const events: string[] = [];
  const ops = operations(events);
  ops.stage = async () => { events.push('stage'); throw new Error('sensitive upstream detail'); };
  ops.abort = async () => { events.push('abort'); throw new Error('sensitive rollback detail'); };
  await rejects(restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops),
    (error: unknown) => error instanceof RestoreOrchestrationError && error.code === 'recovery_required' && error.stage === 'abort');
  deepStrictEqual(events, ['begin', 'stage', 'abort']);
});

test('lost lock response leaves the group locked for explicit recovery', async () => {
  const events: string[] = [];
  const ops = operations(events);
  ops.begin = async () => { events.push('begin'); throw new Error('network'); };
  await rejects(restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops),
    (error: unknown) => error instanceof RestoreOrchestrationError && error.code === 'recovery_required');
  deepStrictEqual(events, ['begin', 'outcome']);
});

test('lost commit response with durable marker continues only to cleanup', async () => {
  const events: string[] = [];
  const ops = operations(events, 'committed');
  ops.commit = async () => { events.push('commit'); throw new Error('network'); };
  const result = await restoreGroupFromPackage('alice', 'g', restoreId, await archive(), env, fetch, ops);
  deepStrictEqual(events, ['begin', 'stage', 'inventory', 'commit', 'outcome', 'cleanup']);
  strictEqual(result.cleanupPending, false);
});
