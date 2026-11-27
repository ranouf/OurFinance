import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateQuotaSnapshot } from './check.mjs';

const accountTag = 'ee6efc358047574c12f44e1411e0bf71';
const repository = 'ranouf/OurFinance';
const markerPrefix = 'ourfinance-test-cloudflare-quota-v1';
const query = `query Usage($accountTag: string, $start: string, $end: string) {
  viewer { accounts(filter: {accountTag: $accountTag}) {
    workersInvocationsAdaptive(limit: 10000, filter: {datetime_geq: $start, datetime_leq: $end}) {
      sum { requests errors }
    }
  }}
}`;

export async function readAccountRequests({ now, token, fetchImpl = fetch }) {
  if (!token) throw new Error('cloudflare_token_missing');
  const day = now.toISOString().slice(0, 10);
  const response = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { accountTag, start: `${day}T00:00:00.000Z`, end: now.toISOString() } }),
  });
  if (!response.ok) throw new Error(`cloudflare_analytics_${response.status}`);
  const data = await response.json();
  if (data.errors?.length) throw new Error('cloudflare_analytics_query_failed');
  const rows = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
  if (!Array.isArray(rows)) throw new Error('cloudflare_analytics_missing');
  return rows.reduce((sum, row) => sum + Number(row.sum?.requests ?? 0), 0);
}

export async function checkCloudflareAlert({ now, cloudflareToken, githubToken, githubRepository,
  simulatedRequests, fetchImpl = fetch }) {
  if (githubRepository !== repository || !githubToken) throw new Error('invalid_alert_context');
  const simulation = simulatedRequests !== undefined && simulatedRequests !== '';
  const requests = simulation ? Number(simulatedRequests) : await readAccountRequests({ now, token: cloudflareToken, fetchImpl });
  const row = evaluateQuotaSnapshot({ recordedAt: now.toISOString(), cloudflareAccountRequests: requests })
    .find(metric => metric.key === 'cloudflareAccountRequests');
  if (row.state === 'ok') return { state: 'ok', requests };
  const day = now.toISOString().slice(0, 10);
  const marker = `<!-- ${markerPrefix}:${day}:${row.state}:${simulation ? 'simulation' : 'mesure'} -->`;
  const headers = { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28' };
  const endpoint = `https://api.github.com/repos/${repository}/issues/159/comments`;
  for (let page = 1; ; page++) {
    const response = await fetchImpl(`${endpoint}?per_page=100&page=${page}`, { headers });
    if (!response.ok) throw new Error(`github_comments_${response.status}`);
    const comments = await response.json();
    if (!Array.isArray(comments)) throw new Error('github_comments_invalid');
    if (comments.some(comment => comment.user?.login === 'github-actions[bot]' && comment.body?.includes(marker))) {
      return { state: 'already_sent', requests };
    }
    if (comments.length < 100) break;
  }
  const body = `${marker}\n${simulation ? '**Simulation de la notification**' : '**Mesure Cloudflare TEST**'} : ${requests} requêtes sur le compte Workers Free depuis 00:00 UTC le ${day}, soit ${row.percent} % de la limite de 100 000/jour. Seuil ${row.state === 'intervention' ? '90 % : suspendre les essais générateurs de trafic, nettoyer les fixtures et attendre le reset UTC' : '70 % : vérifier la tendance et les fixtures'}. Ne pas confondre ce quota global avec la limite par IP du Worker. Voir \`docs/M6_QUOTAS_FREE.md\` pour le retour sous quota.`;
  const posted = await fetchImpl(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }) });
  if (!posted.ok) throw new Error(`github_comment_${posted.status}`);
  return { state: row.state, requests };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkCloudflareAlert({ now: new Date(),
    cloudflareToken: process.env.CLOUDFLARE_TEST_API_TOKEN,
    githubToken: process.env.GITHUB_TOKEN,
    githubRepository: process.env.GITHUB_REPOSITORY,
    simulatedRequests: process.env.SIMULATED_REQUESTS });
  console.log(result.state);
}
