import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishThenRefresh } from '../../src/app/features/expenses/publish-refresh';
import { expenseText } from '../../src/app/features/expenses/expense-text';
import { language } from '../../src/app/shared/utils/i18n';

test('une publication confirmée reste confirmée si la lecture suivante échoue', async () => {
  let publications = 0;
  const result = await publishThenRefresh(
    async () => { publications++; },
    async (): Promise<string[]> => { throw new Error('lecture indisponible'); },
  );
  assert.equal(publications, 1);
  assert.deepEqual(result, { refreshed: false });
});

test('un échec de publication reste distinct et ne déclenche aucune lecture', async () => {
  let lectures = 0;
  await assert.rejects(() => publishThenRefresh(
    async () => { throw new Error('publication refusée'); },
    async () => { lectures++; return []; },
  ), /publication refusée/);
  assert.equal(lectures, 0);
});

test('les confirmations après erreur de lecture sont traduites', () => {
  const previous = language();
  try {
    for (const value of ['fr', 'en', 'ja'] as const) {
      language.set(value);
      for (const key of ['commentPublishedRefreshFailed', 'receiptAddedRefreshFailed'] as const) {
        assert.ok(expenseText(key).length > 20);
      }
    }
  } finally { language.set(previous); }
});
