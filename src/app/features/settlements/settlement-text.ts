import { language } from '../../shared/utils/i18n';

const messages = {
  fr: {
    title: 'Déclarer un remboursement', intro: 'Enregistre un remboursement que vous avez envoyé. Aucun argent n’est transféré.', recipient: 'Remboursé à', chooseMember: 'Choisir un membre', amount: 'Montant', currency: 'Devise du groupe', date: 'Date', save: 'Enregistrer le remboursement', membersUnavailable: 'Membres indisponibles.', chooseActive: 'Choisissez un membre actif.', invalidAmount: 'Montant invalide pour cette devise', amountHigh: 'Montant trop élevé', positive: 'Montant positif requis.', saved: 'Remboursement enregistré.', saveFailed: 'Enregistrement impossible.',
  },
  en: {
    title: 'Record a repayment', intro: 'Record a repayment you sent. No money is transferred.', recipient: 'Repaid to', chooseMember: 'Choose a member', amount: 'Amount', currency: 'Group currency', date: 'Date', save: 'Record repayment', membersUnavailable: 'Members unavailable.', chooseActive: 'Choose an active member.', invalidAmount: 'Invalid amount for this currency', amountHigh: 'Amount is too high', positive: 'Enter a positive amount.', saved: 'Repayment recorded.', saveFailed: 'Could not record the repayment.',
  },
  ja: {
    title: '返済を記録', intro: '送金済みの返済を記録します。この操作で送金は行われません。', recipient: '返済先', chooseMember: 'メンバーを選択', amount: '金額', currency: 'グループの通貨', date: '日付', save: '返済を記録', membersUnavailable: 'メンバーを取得できません。', chooseActive: '有効なメンバーを選択してください。', invalidAmount: 'この通貨の金額が無効です', amountHigh: '金額が大きすぎます', positive: '正の金額を入力してください。', saved: '返済を記録しました。', saveFailed: '返済を記録できません。',
  },
} as const;

export type SettlementTextKey = keyof typeof messages.fr;
export function settlementText(key: SettlementTextKey): string { return messages[language()][key]; }
const sourceErrors: Record<string, SettlementTextKey> = {
  'Membres indisponibles.': 'membersUnavailable', 'Choisissez un membre actif.': 'chooseActive', 'Montant invalide pour cette devise': 'invalidAmount', 'Montant trop élevé': 'amountHigh', 'Montant positif requis.': 'positive', 'Remboursement enregistré.': 'saved', 'Enregistrement impossible': 'saveFailed', 'Montant invalide': 'invalidAmount',
};
export function settlementMessage(value: string): string { return sourceErrors[value] ? settlementText(sourceErrors[value]) : value; }
