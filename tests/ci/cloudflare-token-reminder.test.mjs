import { strictEqual, rejects, throws } from 'node:assert';
import { test } from 'node:test';
import { REMINDER_MARKER, reminderDue, sendReminder } from '../../scripts/cloudflare-token-reminder.mjs';

test('the reminder begins 90 days before the audited expiry', () => {
  strictEqual(reminderDue(new Date('2027-08-18T23:59:59Z'), '2027-11-17'), false);
  strictEqual(reminderDue(new Date('2027-08-19T00:00:00Z'), '2027-11-17'), true);
  throws(() => reminderDue(new Date(), '2027-02-30'), /invalid_expiry_date/);
});

test('a pre-expiry run never calls GitHub', async () => {
  strictEqual(await sendReminder({
    now: new Date('2026-11-18T00:00:00Z'), expiryDate: '2027-11-17',
    token: 'test', repository: 'ranouf/OurFinance', fetchImpl: () => { throw new Error('called'); },
  }), 'not_due');
});

test('a due run posts once and a later run detects its marker', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return { ok: true, status: 201 };
    return { ok: true, json: async () => [] };
  };
  const input = { now: new Date('2027-08-19T00:00:00Z'), expiryDate: '2027-11-17', token: 'test', repository: 'ranouf/OurFinance' };
  strictEqual(await sendReminder({ ...input, fetchImpl }), 'sent');
  strictEqual(calls.length, 2);
  strictEqual(JSON.parse(calls[1].options.body).body.includes(`${REMINDER_MARKER}:2027-11-17`), true);
  strictEqual(await sendReminder({ ...input, fetchImpl: async () => ({ ok: true, json: async () => [{ user: { login: 'github-actions[bot]' }, body: `<!-- ${REMINDER_MARKER}:2027-11-17 -->` }] }) }), 'already_sent');
  let postedAfterUntrustedMarker = false;
  strictEqual(await sendReminder({ ...input, fetchImpl: async (_url, options) => {
    if (options.method === 'POST') { postedAfterUntrustedMarker = true; return { ok: true }; }
    return { ok: true, json: async () => [{ user: { login: 'other-user' }, body: `<!-- ${REMINDER_MARKER}:2027-11-17 -->` }] };
  } }), 'sent');
  strictEqual(postedAfterUntrustedMarker, true);
  strictEqual(await sendReminder({ ...input, expiryDate: '2028-11-17', now: new Date('2028-08-19T00:00:00Z'), fetchImpl }), 'sent');
});

test('GitHub failures fail the job without posting a misleading reminder', async () => {
  await rejects(sendReminder({
    now: new Date('2027-08-19T00:00:00Z'), expiryDate: '2027-11-17', token: 'test',
    repository: 'ranouf/OurFinance', fetchImpl: async () => ({ ok: false, status: 503 }),
  }), /github_comments_503/);
});
