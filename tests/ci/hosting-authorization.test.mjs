import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha = 'a'.repeat(40);
const issue = number => `https://api.github.com/repos/ranouf/OurFinance/issues/${number}`;
const githubDate = milliseconds => new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, 'Z');

function verify({ channel = 'live', reservation = {}, approval = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ourfinance-hosting-gate-'));
  try {
    const reservationFile = join(dir, 'reservation.json');
    const approvalFile = join(dir, 'approval.json');
    writeFileSync(reservationFile, JSON.stringify({
      user: { login: 'ranouf' }, issue_url: issue(30),
      created_at: githubDate(Date.now() - 60_000),
      body: `Réservation TEST active pour ${sha}`, ...reservation,
    }));
    writeFileSync(approvalFile, JSON.stringify({
      user: { login: 'ranouf' }, issue_url: issue(122),
      body: `Validation visuelle approuvée pour ${channel} ${sha}`, ...approval,
    }));
    return spawnSync('bash', ['scripts/verify-hosting-test-authorization.sh', sha, channel,
      reservationFile, approvalFile], { encoding: 'utf8' }).status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('explicit reservation and approval accept both channels', () => {
  strictEqual(verify(), 0);
  strictEqual(verify({ channel: 'preview' }), 0);
});

test('cancelled or qualified reservations do not authorize deployment', () => {
  strictEqual(verify({ reservation: { body: `Réservation TEST annulée pour ${sha}` } }) === 0, false);
  strictEqual(verify({ reservation: { body: `Réservation TEST active pour ${sha}\nAnnulée` } }) === 0, false);
  strictEqual(verify({ reservation: { created_at: githubDate(Date.now() - 3_700_000) } }) === 0, false);
});

test('refusal, negation, wrong channel or SHA do not authorize deployment', () => {
  strictEqual(verify({ approval: { body: `Validation visuelle non approuvée pour live ${sha}` } }) === 0, false);
  strictEqual(verify({ channel: 'preview', approval: { body: `Validation visuelle refusée pour preview ${sha}` } }) === 0, false);
  strictEqual(verify({ approval: { body: `Validation visuelle approuvée pour preview ${sha}` } }) === 0, false);
  strictEqual(verify({ approval: { body: `Validation visuelle approuvée pour live ${'b'.repeat(40)}` } }) === 0, false);
});

test('comments from another author or issue cannot authorize deployment', () => {
  strictEqual(verify({ reservation: { user: { login: 'someone-else' } } }) === 0, false);
  strictEqual(verify({ approval: { issue_url: issue(123) } }) === 0, false);
});
