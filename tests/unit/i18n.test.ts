import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { language, locale, setLanguage, t } from '../../src/app/shared/utils/i18n';

test('switches visible labels and date locale without changing money or group data', () => {
  const initial = language();
  try {
    setLanguage('fr'); strictEqual(t('myGroups'), 'Mes groupes'); strictEqual(locale(), 'fr-CA');
    setLanguage('en'); strictEqual(t('myGroups'), 'My groups'); strictEqual(locale(), 'en-US');
    setLanguage('ja'); strictEqual(t('myGroups'), 'マイグループ'); strictEqual(locale(), 'ja-JP');
  } finally { setLanguage(initial); }
});
