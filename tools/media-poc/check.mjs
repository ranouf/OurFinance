/** Runs only against the named test Worker and a synthetic 1x1 PNG. No ID token is printed or saved. */
const base = new URL(process.env.TEST_WORKER_URL ?? '');
const groupId = process.env.TEST_GROUP_ID;
const expenseId = process.env.TEST_EXPENSE_ID;
if (base.protocol !== 'https:' || base.hostname !== 'ourfinance-api-dev.ur-inance.workers.dev' || !groupId || !expenseId ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(groupId) || !/^[A-Za-z0-9_-]{1,128}$/.test(expenseId)) throw new Error('Cible de test invalide');
const path = `/groups/${groupId}/expenses/${expenseId}/attachments`;
const owner = process.env.TEST_OWNER_ID_TOKEN;
const member = process.env.TEST_MEMBER_ID_TOKEN;
const outsider = process.env.TEST_OUTSIDER_ID_TOKEN;
const stage = process.env.TEST_STAGE ?? 'upload';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64'));
const request = (suffix, token, method = 'GET', body) => fetch(new URL(path + suffix, base), {
  method, headers: { Authorization: `Bearer ${token}`, Origin: 'https://ourfinance-test.web.app', ...(body ? { 'Content-Type': 'image/png' } : {}) }, body, redirect: 'error',
});
async function check(label, response, expected) {
  const status = response.status;
  console.log(`${label}: HTTP ${status} (attendu ${expected})`);
  if (status !== expected) {
    process.exitCode = 1;
    if (status === 502) {
      const body = await response.clone().json().catch(() => null);
      const codes = new Set(['member_read', 'expense_read', 'metadata_read', 'download_sign', 'download_fetch', 'download_redirect', 'download_response', 'internal']);
      if (codes.has(body?.code)) console.log(`${label}: étape sûre ${body.code}`);
    }
  }
}
if (stage === 'upload') {
  if (!owner || !member || !outsider) throw new Error('Jetons de comptes fictifs manquants');
  const upload = await request('', owner, 'POST', png);
  await check('upload propriétaire', upload, 201);
  if (upload.status === 201) {
    const { attachmentId } = await upload.json();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(attachmentId)) throw new Error('Identifiant de pièce invalide');
    console.log(`TEST_ATTACHMENT_ID=${attachmentId}`);
    await check('lecture propriétaire', await request('/' + attachmentId, owner), 200);
    await check('lecture membre', await request('/' + attachmentId, member), 200);
    await check('lecture tiers', await request('/' + attachmentId, outsider), 403);
    const publicUrl = new URL(`https://res.cloudinary.com/ldojfo7y/image/authenticated/ourfinance-test/${groupId}/${expenseId}/${attachmentId}.png`);
    const direct = await fetch(publicUrl, { redirect: 'error' });
    console.log(`URL Cloudinary non signée : HTTP ${direct.status} (attendu différent de 200)`);
    if (direct.status === 200) process.exitCode = 1;
  }
} else if (stage === 'revoked') {
  const attachmentId = process.env.TEST_ATTACHMENT_ID;
  const revoked = process.env.TEST_REVOKED_ID_TOKEN;
  if (!attachmentId || !revoked) throw new Error('Pièce ou jeton révoqué manquant');
  await check('lecture membre révoqué', await request('/' + attachmentId, revoked), 403);
} else if (stage === 'cleanup') {
  const attachmentId = process.env.TEST_ATTACHMENT_ID;
  if (!attachmentId || !owner) throw new Error('Pièce ou jeton propriétaire manquant');
  await check('suppression', await request('/' + attachmentId, owner, 'DELETE'), 204);
  await check('lecture après suppression', await request('/' + attachmentId, owner), 404);
} else throw new Error('Étape de test inconnue');
