import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { validateGroupMetadata } from '../../../src/app/core/firebase/group-metadata';
import { validateNewGroup, createGroup } from '../src/groups';
import { GroupMetadataError, updateGroupMetadata } from '../src/group-metadata';

test('metadata uses a bounded renderable catalogue and keeps legacy creation valid', () => {
  deepStrictEqual(validateNewGroup({ name: ' Duplex ', currency: 'CAD' }), { name: 'Duplex', currency: 'CAD' });
  deepStrictEqual(validateGroupMetadata({ name: ' Duplex ', iconId: 'home', color: 'violet', description: '  Frais  ' }),
    { name: 'Duplex', iconId: 'home', color: 'violet', description: 'Frais' });
  for (const metadata of [{ name: 'x', iconId: '<svg>' }, { name: 'x', color: '#fff' }, { name: 'x', description: 'x'.repeat(501) }, { name: 'x', currency: 'JPY' }]) {
    throws(() => validateGroupMetadata(metadata), /invalid_group_metadata/);
  }
  throws(() => validateNewGroup({ name: 'x', currency: 'CAD', ownerId: 'attacker' }), /Groupe invalide/);
});

async function fixture(role = 'owner', status = 'active', groupStatus = 'active') {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey),
  }) };
  let commit: { transaction?: string; writes: any[] } | undefined;
  const transport = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'transaction' });
    if (url.includes('/members/alice?')) return Response.json({ fields: { role: { stringValue: role }, status: { stringValue: status } } });
    if (url.includes('/groups/group1?')) return Response.json({ fields: { status: { stringValue: groupStatus }, currencyCode: { stringValue: 'CAD' } } });
    if (url.endsWith(':commit')) { commit = JSON.parse(String(init?.body)); return Response.json({ writeResults: [] }); }
    if (url.endsWith(':rollback')) return Response.json({});
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  return { env, transport, committed: () => commit };
}

test('creation persists optional fields atomically', async () => {
  const f = await fixture();
  await createGroup({ name: 'Duplex', currency: 'CAD', iconId: 'home', color: 'violet', description: 'Frais' }, 'alice', f.env, f.transport);
  deepStrictEqual(f.committed()?.writes[0].update.fields.iconId, { stringValue: 'home' });
  deepStrictEqual(f.committed()?.writes[0].update.fields.description, { stringValue: 'Frais' });
});

test('only an active owner may edit metadata, never currency', async () => {
  const f = await fixture();
  await updateGroupMetadata({ name: 'Nouveau', iconId: 'home', color: 'violet', description: '' }, 'alice', 'group1', f.env, f.transport);
  deepStrictEqual(f.committed()?.writes[0].updateMask.fieldPaths, ['name', 'iconId', 'color', 'description', 'updatedBy', 'updatedAt']);
  strictEqual(f.committed()?.writes[0].update.fields.currencyCode, undefined);
  strictEqual(f.committed()?.writes[1].update.fields.action.stringValue, 'group_updated');
  for (const denied of [await fixture('member'), await fixture('owner', 'revoked'), await fixture('owner', 'active', 'archived')]) {
    await rejects(updateGroupMetadata({ name: 'Nouveau' }, 'alice', 'group1', denied.env, denied.transport),
      (error: unknown) => error instanceof GroupMetadataError && error.status === 403);
    strictEqual(denied.committed(), undefined);
  }
});
