import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha = 'a'.repeat(40);
const issue = number => `https://api.github.com/repos/ranouf/OurFinance/issues/${number}`;
const githubDate = milliseconds => new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, 'Z');

function verify(overrides = {}, targetSha = sha) {
  const dir = mkdtempSync(join(tmpdir(), 'ourfinance-test-reservation-'));
  try {
    const commentFile = join(dir, 'comment.json');
    writeFileSync(commentFile, JSON.stringify({
      user: { login: 'ranouf' },
      issue_url: issue(30),
      created_at: githubDate(Date.now() - 60_000),
      body: `Réservation TEST active pour ${sha}`,
      ...overrides,
    }));
    return spawnSync('bash', ['scripts/verify-test-reservation.sh', targetSha, commentFile],
      { encoding: 'utf8' }).status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('exact active reservation authorizes the target SHA', () => {
  strictEqual(verify(), 0);
  strictEqual(verify({ body: `Réservation TEST active pour ${sha}\n` }), 0);
});

test('cancelled, qualified, old and future reservations are refused', () => {
  strictEqual(verify({ body: `Réservation TEST annulée pour ${sha}` }) === 0, false);
  strictEqual(verify({ body: `Réservation TEST active pour ${sha}\nAnnulée` }) === 0, false);
  strictEqual(verify({ created_at: githubDate(Date.now() - 3_700_000) }) === 0, false);
  strictEqual(verify({ created_at: githubDate(Date.now() + 60_000) }) === 0, false);
});

test('other author, issue and SHA cannot authorize deployment', () => {
  strictEqual(verify({ user: { login: 'someone-else' } }) === 0, false);
  strictEqual(verify({ issue_url: issue(123) }) === 0, false);
  strictEqual(verify({}, 'b'.repeat(40)) === 0, false);
});
