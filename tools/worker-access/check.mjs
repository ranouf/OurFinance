/** Run locally with synthetic Firebase accounts. Never prints or stores ID tokens. */
const endpoint = process.env.TEST_WORKER_URL;
const groupId = process.env.TEST_GROUP_ID;
if (!endpoint || !groupId || !/^[A-Za-z0-9_-]{1,128}$/.test(groupId)) throw new Error('URL Worker ou groupe de test absent');
const base = new URL(endpoint);
if (base.protocol !== 'https:' || base.hostname !== 'ourfinance-api-dev.ur-inance.workers.dev') throw new Error('URL Worker de test inattendue');
const expected = process.env.TEST_STAGE === 'revoked'
  ? [['révoqué', process.env.TEST_REVOKED_ID_TOKEN, 403]]
  : [
      ['membre', process.env.TEST_MEMBER_ID_TOKEN, 200],
      ['tiers', process.env.TEST_OUTSIDER_ID_TOKEN, 403],
    ];
let failures = 0;
for (const [label, token, wanted] of expected) {
  if (!token) { console.log(`${label}: NON TESTÉ (jeton absent)`); continue; }
  const response = await fetch(new URL(`/groups/${groupId}/access`, base), {
    headers: { Authorization: `Bearer ${token}`, Origin: 'https://ourfinance-test.web.app' },
    redirect: 'error',
  });
  console.log(`${label}: HTTP ${response.status} (attendu ${wanted})`);
  if (response.status !== wanted) failures++;
}
if (failures) process.exitCode = 1;
