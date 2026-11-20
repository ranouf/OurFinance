import { withBatchGet } from './batch-get-mock';
import { test } from 'node:test';
import { deepStrictEqual, rejects, strictEqual, throws } from 'node:assert';
import { exportPKCS8, generateKeyPair } from 'jose';
import { createComment, CommentError, parseComment } from '../src/comments';

const input = { idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', text: '  Commentaire fictif  ' };

test('valide le commentaire avant la transaction', () => {
  strictEqual(parseComment(input).text, 'Commentaire fictif');
  throws(() => parseComment({ ...input, text: ' ' }), CommentError);
  throws(() => parseComment({ ...input, text: 'x'.repeat(1001) }), CommentError);
  throws(() => parseComment({ ...input, idempotencyKey: '../outside' }), CommentError);
});

async function fixture(status: 'active' | 'revoked' | 'absent' = 'active', deleted = false, repeated = false) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const env = { FIREBASE_PROJECT_ID: 'ourfinance-test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'ourfinance-test', client_email: 'test@ourfinance-test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) }) };
  let commit: Record<string, unknown> | undefined;
  let rollback = false;
  const transport = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'service-token' });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'txn' });
    if (url.endsWith(':commit')) { commit = JSON.parse(String(options?.body)); return Response.json({ writeResults: [{}, {}] }); }
    if (url.endsWith(':rollback')) { rollback = true; return Response.json({}); }
    if (url.includes('/members/alice?')) return status === 'absent' ? new Response(null, { status: 404 }) : Response.json({ fields: { status: { stringValue: status } } });
    if (url.includes('/expenses/expense/comments/')) return repeated ? Response.json({ fields: { authorId: { stringValue: 'alice' }, text: { stringValue: 'Commentaire fictif' } } }) : new Response(null, { status: 404 });
    if (url.includes('/expenses/expense?')) return Response.json({ fields: { deleted: { booleanValue: deleted } } });
    if (url.includes('/groups/group?')) return Response.json({ fields: { status: { stringValue: 'active' } } });
    throw new Error('Requête inattendue');
  };
  return { env, transport: withBatchGet(transport), result: () => ({ commit, rollback }) };
}

test('membre actif écrit commentaire et activité dans la même transaction', async () => {
  const setup = await fixture();
  strictEqual(await createComment(input, 'alice', 'group', 'expense', setup.env, setup.transport), input.idempotencyKey);
  const writes = (setup.result().commit as { writes: { update: { name: string; fields: Record<string, { stringValue?: string }> }; currentDocument: { exists: boolean } }[] }).writes;
  strictEqual(writes.length, 2);
  strictEqual(writes[0].update.fields.text.stringValue, 'Commentaire fictif');
  strictEqual(writes[0].currentDocument.exists, false);
  strictEqual(writes[1].update.fields.action.stringValue, 'comment_created');
});

test('tiers, membre révoqué et dépense supprimée ne créent rien', async () => {
  for (const [status, deleted] of [['absent', false], ['revoked', false], ['active', true]] as const) {
    const setup = await fixture(status, deleted);
    await rejects(createComment(input, 'alice', 'group', 'expense', setup.env, setup.transport), (error: unknown) => error instanceof CommentError && error.status === 403);
    deepStrictEqual(setup.result(), { commit: undefined, rollback: true });
  }
});

test('rejeu identique ne duplique ni commentaire ni activité', async () => {
  const setup = await fixture('active', false, true);
  strictEqual(await createComment(input, 'alice', 'group', 'expense', setup.env, setup.transport), input.idempotencyKey);
  deepStrictEqual(setup.result(), { commit: undefined, rollback: true });
});
