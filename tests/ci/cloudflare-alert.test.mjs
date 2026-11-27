import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert';
import { checkCloudflareAlert, readAccountRequests } from '../../tools/quota-monitor/cloudflare-alert.mjs';

const now = new Date('2026-11-27T17:00:00Z');
const base = { now, cloudflareToken: 'fake', githubToken: 'fake', githubRepository: 'ranouf/OurFinance' };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test('lit le quota du compte entier depuis Analytics', async () => {
  const calls = [];
  const requests = await readAccountRequests({ now, token: 'fake', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return response({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [
      { sum: { requests: 10 } }, { sum: { requests: 15 } },
    ] }] } } });
  } });
  strictEqual(requests, 25);
  strictEqual(calls.length, 1);
  strictEqual(JSON.parse(calls[0].options.body).variables.start, '2026-11-27T00:00:00.000Z');
});

test('ne publie rien sous le seuil', async () => {
  let calls = 0;
  const result = await checkCloudflareAlert({ ...base, simulatedRequests: 69_999,
    fetchImpl: async () => { calls++; throw new Error('appel inattendu'); } });
  strictEqual(result.state, 'ok');
  strictEqual(calls, 0);
});

test('publie au seuil et ne répète pas la même alerte', async () => {
  let body = '';
  const fetchImpl = async (url, options) => {
    if (options.method === 'POST') { body = JSON.parse(options.body).body; return response({}); }
    return response(body ? [{ user: { login: 'github-actions[bot]' }, body }] : []);
  };
  const first = await checkCloudflareAlert({ ...base, simulatedRequests: 70_000, fetchImpl });
  const second = await checkCloudflareAlert({ ...base, simulatedRequests: 70_000, fetchImpl });
  strictEqual(first.state, 'warning');
  strictEqual(second.state, 'already_sent');
  strictEqual(body.includes('Simulation de la notification'), true);
});

test('distingue la simulation de la mesure réelle et le seuil 90 %', async () => {
  let posted = '';
  const fetchImpl = async (url, options) => {
    if (url.includes('cloudflare.com')) return response({ data: { viewer: { accounts: [
      { workersInvocationsAdaptive: [{ sum: { requests: 90_001 } }] },
    ] } } });
    if (options.method === 'POST') { posted = JSON.parse(options.body).body; return response({}); }
    return response([]);
  };
  const result = await checkCloudflareAlert({ ...base, fetchImpl });
  strictEqual(result.state, 'intervention');
  strictEqual(posted.includes('Mesure Cloudflare TEST'), true);
  strictEqual(posted.includes('90 %'), true);
});

test('échoue clairement si Analytics ou GitHub refuse', async () => {
  await rejects(() => readAccountRequests({ now, token: 'fake', fetchImpl: async () => response({}, 403) }),
    /cloudflare_analytics_403/);
  await rejects(() => checkCloudflareAlert({ ...base, simulatedRequests: 70_000,
    fetchImpl: async () => response({}, 403) }), /github_comments_403/);
});
