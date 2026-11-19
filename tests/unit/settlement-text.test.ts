import { strictEqual } from 'node:assert';
import { test } from 'node:test';
import { setLanguage } from '../../src/app/shared/utils/i18n';
import { settlementMessage, settlementText } from '../../src/app/features/settlements/settlement-text';

test('repayment validation and confirmation messages follow the selected language', () => {
  const expected = {
    fr: ['Montant positif requis.', 'Remboursement enregistré.'],
    en: ['Enter a positive amount.', 'Repayment recorded.'],
    ja: ['正の金額を入力してください。', '返済を記録しました。'],
  } as const;
  try {
    for (const current of ['fr', 'en', 'ja'] as const) {
      setLanguage(current);
      strictEqual(settlementMessage('Montant positif requis.'), expected[current][0]);
      strictEqual(settlementMessage('Remboursement enregistré.'), expected[current][1]);
      strictEqual(settlementMessage('Montant invalide pour cette devise'), settlementText('invalidAmount'));
      strictEqual(settlementMessage('Remboursements désactivés sur cet environnement'), settlementText('serviceDisabled'));
      strictEqual(settlementMessage('Enregistrement refusé (HTTP 403)'), `${settlementText('rejected')} (HTTP 403)`);
      strictEqual(settlementMessage('Réponse du service invalide'), settlementText('invalidResponse'));
      strictEqual(settlementMessage('unexpected'), settlementText('saveFailed'));
    }
  } finally { setLanguage('fr'); }
});
