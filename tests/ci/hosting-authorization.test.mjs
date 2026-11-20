import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha = 'a'.repeat(40);
const issue = number => `https://api.github.com/repos/ranouf/OurFinance/issues/${number}`;
const githubDate = milliseconds => new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, 'Z');

function verify({ channel = 'live', reservation = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ourfinance-hosting-gate-'));
  try {
    const reservationFile = join(dir, 'reservation.json');
    writeFileSync(reservationFile, JSON.stringify({
      user: { login: 'ranouf' }, issue_url: issue(30),
      created_at: githubDate(Date.now() - 60_000),
      body: `Réservation TEST active pour ${sha}`, ...reservation,
    }));
    return spawnSync('bash', ['scripts/verify-hosting-test-authorization.sh', sha, channel,
      reservationFile], { encoding: 'utf8' }).status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a current reservation accepts both TEST channels without visual approval', () => {
  strictEqual(verify(), 0);
  strictEqual(verify({ channel: 'preview' }), 0);
});

test('cancelled or qualified reservations do not authorize deployment', () => {
  strictEqual(verify({ reservation: { body: `Réservation TEST annulée pour ${sha}` } }) === 0, false);
  strictEqual(verify({ reservation: { body: `Réservation TEST active pour ${sha}\nAnnulée` } }) === 0, false);
  strictEqual(verify({ reservation: { created_at: githubDate(Date.now() - 3_700_000) } }) === 0, false);
});

test('other channels and reservations for another SHA are rejected', () => {
  strictEqual(verify({ channel: 'production' }) === 0, false);
  strictEqual(verify({ reservation: { body: `Réservation TEST active pour ${'b'.repeat(40)}` } }) === 0, false);
});

test('comments from another author or issue cannot authorize deployment', () => {
  strictEqual(verify({ reservation: { user: { login: 'someone-else' } } }) === 0, false);
  strictEqual(verify({ reservation: { issue_url: issue(123) } }) === 0, false);
});
