import { language } from '../../shared/utils/i18n';

const messages = {
  fr: {
    title: 'Déclarer un remboursement', intro: 'Enregistre un remboursement que vous avez envoyé. Aucun argent n’est transféré.', recipient: 'Remboursé à', chooseMember: 'Choisir un membre', amount: 'Montant', currency: 'Devise du groupe', date: 'Date', save: 'Enregistrer le remboursement', membersUnavailable: 'Membres indisponibles.', chooseActive: 'Choisissez un membre actif.', invalidAmount: 'Montant invalide pour cette devise', amountHigh: 'Montant trop élevé', positive: 'Montant positif requis.', saved: 'Remboursement enregistré.', saveFailed: 'Enregistrement impossible.', emailUnverified: 'Confirmez votre adresse courriel.', insecureService: 'Service de remboursement indisponible.', serviceDisabled: 'Remboursements désactivés dans cet environnement.', rejected: 'Enregistrement refusé', invalidResponse: 'Réponse du service invalide.',
  },
  en: {
    title: 'Record a repayment', intro: 'Record a repayment you sent. No money is transferred.', recipient: 'Repaid to', chooseMember: 'Choose a member', amount: 'Amount', currency: 'Group currency', date: 'Date', save: 'Record repayment', membersUnavailable: 'Members unavailable.', chooseActive: 'Choose an active member.', invalidAmount: 'Invalid amount for this currency', amountHigh: 'Amount is too high', positive: 'Enter a positive amount.', saved: 'Repayment recorded.', saveFailed: 'Could not record the repayment.', emailUnverified: 'Confirm your email address.', insecureService: 'Repayment service is unavailable.', serviceDisabled: 'Repayments are disabled in this environment.', rejected: 'Recording was refused', invalidResponse: 'Invalid service response.',
  },
  ja: {
    title: '返済を記録', intro: '送金済みの返済を記録します。この操作で送金は行われません。', recipient: '返済先', chooseMember: 'メンバーを選択', amount: '金額', currency: 'グループの通貨', date: '日付', save: '返済を記録', membersUnavailable: 'メンバーを取得できません。', chooseActive: '有効なメンバーを選択してください。', invalidAmount: 'この通貨の金額が無効です', amountHigh: '金額が大きすぎます', positive: '正の金額を入力してください。', saved: '返済を記録しました。', saveFailed: '返済を記録できません。', emailUnverified: 'メールアドレスを確認してください。', insecureService: '返済サービスを利用できません。', serviceDisabled: 'この環境では返済が無効です。', rejected: '記録が拒否されました', invalidResponse: 'サービスの応答が無効です。',
  },
} as const;

export type SettlementTextKey = keyof typeof messages.fr;
export function settlementText(key: SettlementTextKey): string { return messages[language()][key]; }
const sourceErrors: Record<string, SettlementTextKey> = {
  'Membres indisponibles.': 'membersUnavailable', 'Choisissez un membre actif.': 'chooseActive', 'Montant invalide pour cette devise': 'invalidAmount', 'Montant trop élevé': 'amountHigh', 'Montant positif requis.': 'positive', 'Remboursement enregistré.': 'saved', 'Enregistrement impossible': 'saveFailed', 'Montant invalide': 'invalidAmount', 'Adresse courriel non confirmée': 'emailUnverified', 'URL du service non sécurisée': 'insecureService', 'Remboursements désactivés sur cet environnement': 'serviceDisabled', 'Réponse du service invalide': 'invalidResponse',
};
export function settlementMessage(value: string): string {
  if (sourceErrors[value]) return settlementText(sourceErrors[value]);
  const refused = /^Enregistrement refusé \(HTTP (\d{3})\)$/.exec(value);
  return refused ? `${settlementText('rejected')} (HTTP ${refused[1]})` : settlementText('saveFailed');
}
