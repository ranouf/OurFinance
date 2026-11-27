export const email = 'camille@example.invalid';
export const password = 'Only-in-local-emulators-123';
export const projectId = 'ourfinance-test';
const auth = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const documents = 'http://127.0.0.1:8080/v1/projects/' + projectId + '/databases/(default)/documents/';

async function json(url, method, body) {
  const response = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Fixture locale refusée : ' + response.status + ' ' + await response.text());
  return response.json();
}

export default async function seed() {
  const { localId } = await json(auth + '/accounts:signUp?key=demo', 'POST', { email, password });
  await json(auth + '/accounts:update?key=demo', 'POST', { localId, emailVerified: true });
  async function document(path, values) {
    const fields = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { stringValue: value }]));
    await json(documents + path, 'PATCH', { fields });
  }
  const memberEmail = 'alex@example.invalid';
  const { localId: memberId } = await json(auth + '/accounts:signUp?key=demo', 'POST', { email: memberEmail, password });
  await json(auth + '/accounts:update?key=demo', 'POST', { localId: memberId, emailVerified: true });
  for (const [id, name, currency] of [['famille', 'Famille recette', 'CAD'], ['voyage', 'Voyage recette', 'EUR']]) {
    await document('groups/' + id, { name, currencyCode: currency, ownerId: localId, status: 'active' });
    await document('groups/' + id + '/members/' + localId, { status: 'active', role: 'owner', displayName: 'Camille' });
    await document('groups/' + id + '/members/' + memberId, { status: id === 'famille' ? 'active' : 'revoked', role: 'member', displayName: 'Alex' });
    await document('users/' + memberId + '/groupMemberships/' + id, { groupId: id });
    await document('users/' + localId + '/groupMemberships/' + id, { status: 'active', groupId: id });
  }
  const amounts = (entries) => ({ arrayValue: { values: entries.map(([userId, amountMinor]) => ({
    mapValue: { fields: { userId: { stringValue: userId }, amountMinor: { integerValue: amountMinor } } },
  })) } });
  await json(documents + 'groups/famille/expenses/repas', 'PATCH', { fields: {
    createdBy: { stringValue: localId }, date: { stringValue: '2026-11-19' },
    description: { stringValue: 'Repas de recette' }, currency: { stringValue: 'CAD' },
    splitSnapshotJson: { stringValue: JSON.stringify({ kind: 'equal', users: [localId, memberId] }) },
    amountMinor: { integerValue: 1001 }, categoryId: { stringValue: 'restaurant' },
    payments: amounts([[localId, 1001]]), allocations: amounts([[localId, 501], [memberId, 500]]),
  } });
}
