/** Uses only synthetic rows. Tokens stay in environment variables and are never printed. */
const base = new URL(process.env.TEST_WORKER_URL ?? '');
const groupId = process.env.TEST_GROUP_ID;
const authorId = process.env.TEST_AUTHOR_UID;
const otherId = process.env.TEST_OTHER_UID;
const thirdId = process.env.TEST_THIRD_UID;
const token = process.env.TEST_AUTHOR_ID_TOKEN;
if (base.protocol !== 'https:' || base.hostname !== 'ourfinance-api-dev.ur-inance.workers.dev' ||
    !groupId || !authorId || !otherId || !thirdId || !token ||
    ![groupId, authorId, otherId, thirdId].every(value => /^[A-Za-z0-9_-]{1,128}$/.test(value)) ||
    new Set([authorId, otherId, thirdId]).size !== 3) throw new Error('Fixture de test incomplète');
const endpoint = new URL(`/groups/${groupId}/imports`, base);
const batchId = crypto.randomUUID();
const records = [
  { sourceId: `synthetic-${batchId}-001`, date: '2026-10-01', description: 'Épicerie fictive', currency: 'CAD', amountMinor: 6000, netImpactsMinor: { [authorId]: 4000, [otherId]: -2000, [thirdId]: -2000 } },
  { sourceId: `synthetic-${batchId}-002`, date: '2026-10-03', description: 'Transport fictif', currency: 'CAD', amountMinor: 3000, netImpactsMinor: { [authorId]: -1000, [otherId]: 2000, [thirdId]: -1000 } },
  { sourceId: `synthetic-${batchId}-003`, date: '2026-10-05', description: 'Restaurant fictif', currency: 'CAD', amountMinor: 4500, netImpactsMinor: { [authorId]: -1500, [otherId]: -1500, [thirdId]: 3000 } },
];
const headers = { Authorization: `Bearer ${token}`, Origin: 'https://ourfinance-test.web.app', 'Content-Type': 'application/json' };
const post = body => fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error' });
const created = await post({ batchId, records });
console.log(`Création : HTTP ${created.status} (attendu 201)`);
if (created.status !== 201) process.exitCode = 1;
else {
  const result = await created.json();
  if (result.batchId !== batchId || result.recordCount !== 3) process.exitCode = 1;
  const duplicate = await post({ batchId: crypto.randomUUID(), records });
  console.log(`Sources dupliquées : HTTP ${duplicate.status} (attendu 409)`);
  if (duplicate.status !== 409) process.exitCode = 1;
  const undo = new URL(`/groups/${groupId}/imports/${batchId}`, base);
  const reversed = await fetch(undo, { method: 'DELETE', headers, redirect: 'error' });
  console.log(`Annulation : HTTP ${reversed.status} (attendu 204)`);
  if (reversed.status !== 204) process.exitCode = 1;
  const repeat = await fetch(undo, { method: 'DELETE', headers, redirect: 'error' });
  console.log(`Annulation répétée : HTTP ${repeat.status} (attendu 403)`);
  if (repeat.status !== 403) process.exitCode = 1;
  console.log(`TEST_BATCH_ID=${batchId}`);
}
