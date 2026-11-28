/** Sends only synthetic expense data to the named test Worker. Never prints Firebase ID tokens. */
const base = new URL(process.env.TEST_WORKER_URL ?? '');
const groupId = process.env.TEST_GROUP_ID;
const authorId = process.env.TEST_AUTHOR_UID;
const otherId = process.env.TEST_OTHER_UID;
const token = process.env.TEST_AUTHOR_ID_TOKEN;
if (base.protocol !== 'https:' || base.hostname !== 'ourfinance-api-dev.ur-inance.workers.dev' ||
    !groupId || !authorId || !otherId || !token || ![groupId, authorId, otherId].every(value => /^[A-Za-z0-9_-]{1,128}$/.test(value))) throw new Error('Fixture de test incomplète');
const endpoint = new URL(`/groups/${groupId}/expenses`, base);
const input = {
  idempotencyKey: crypto.randomUUID(), description: 'Dépense fictive POC', currency: 'CAD', date: new Date().toISOString().slice(0, 10), amountMinor: 101,
  payments: [{ userId: authorId, amountMinor: 101 }], splitMode: { kind: 'equal', users: [authorId, otherId] },
};
const post = (body) => fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://ourfinance-test.web.app', 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error' });
const first = await post(input);
console.log(`Création : HTTP ${first.status} (attendu 201)`);
if (first.status !== 201) { process.exitCode = 1; }
else {
  const result = await first.json();
  if (result.expenseId !== input.idempotencyKey) process.exitCode = 1;
  const repeat = await post(input);
  const repeatedId = repeat.status === 201 ? (await repeat.json()).expenseId : undefined;
  console.log(`Répétition identique : HTTP ${repeat.status} (attendu 201)`);
  if (repeat.status !== 201 || repeatedId !== input.idempotencyKey) process.exitCode = 1;
  const changed = await post({ ...input, description: 'Dépense fictive différente' });
  console.log(`Même clé, corps différent : HTTP ${changed.status} (attendu 409)`);
  if (changed.status !== 409) process.exitCode = 1;
  console.log(`TEST_EXPENSE_ID=${input.idempotencyKey}`);
}
