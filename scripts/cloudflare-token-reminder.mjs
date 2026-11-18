import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REMINDER_MARKER = 'cloudflare-test-token-expiry-reminder-v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export function reminderDue(now, expiryDate, daysBefore = 90) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) throw new Error('invalid_expiry_date');
  const expiryMs = Date.parse(`${expiryDate}T00:00:00Z`);
  if (!Number.isFinite(expiryMs) || new Date(expiryMs).toISOString().slice(0, 10) !== expiryDate) {
    throw new Error('invalid_expiry_date');
  }
  return now.getTime() >= expiryMs - daysBefore * DAY_MS;
}

export async function sendReminder({ now, expiryDate, token, repository, fetchImpl = fetch }) {
  if (!reminderDue(now, expiryDate)) return 'not_due';
  if (repository !== 'ranouf/OurFinance' || !token) throw new Error('invalid_reminder_context');

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const base = `https://api.github.com/repos/${repository}/issues/154`;
  const marker = `<!-- ${REMINDER_MARKER}:${expiryDate} -->`;
  for (let page = 1; ; page++) {
    const response = await fetchImpl(`${base}/comments?per_page=100&page=${page}`, { headers });
    if (!response.ok) throw new Error(`github_comments_${response.status}`);
    const comments = await response.json();
    if (!Array.isArray(comments)) throw new Error('invalid_github_comments');
    if (comments.some((comment) => comment.user?.login === 'github-actions[bot]' && typeof comment.body === 'string' && comment.body.includes(marker))) {
      return 'already_sent';
    }
    if (comments.length < 100) break;
  }

  const body = `${marker}\nRappel de rotation : le jeton Cloudflare limité au Worker TEST expire le ${expiryDate} selon l’audit #154. Réserver TEST dans #30, créer un second jeton limité au seul Worker TEST, vérifier le workflow et le smoke authentifié, puis révoquer l’ancien. Ne publier aucune valeur. Mettre à jour la date de ce rappel après la rotation.`;
  const response = await fetchImpl(`${base}/comments`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw new Error(`github_comment_create_${response.status}`);
  return 'sent';
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await sendReminder({
    now: new Date(),
    expiryDate: process.env.TOKEN_EXPIRY_DATE ?? '',
    token: process.env.GITHUB_TOKEN ?? '',
    repository: process.env.GITHUB_REPOSITORY ?? '',
  });
  process.stdout.write(`${result}\n`);
}
