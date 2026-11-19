import { language } from '../../shared/utils/i18n';

const messages = {
  fr: {
    title: 'Statistiques du groupe', intro: 'Dépenses et remboursements dans la devise du groupe. Les imports sans parts restent exclus.', group: 'Groupe', chooseGroup: 'Choisir un groupe', refresh: 'Actualiser', spent: 'Dépenses du groupe', settled: 'Remboursements déclarés', paid: 'Payé par moi', owed: 'Ma part attribuée', balance: 'Mon solde sur la période', moreMeasures: 'Autres mesures', empty: 'Aucune opération pour cette période.', incomplete: 'dépense(s) sans parts connues, exclue(s) du calcul.', unavailable: 'Statistiques indisponibles.',
    period: 'Période', choosePeriod: 'Choisir une période', periodIntro: 'Sélectionnez le début puis la fin, bornes incluses.', close: 'Fermer le sélecteur', units: 'Unité de période', days: 'Jours', months: 'Mois', years: 'Années', firstBound: 'Choisissez une première borne.', previousMonths: 'Mois précédents', nextMonths: 'Mois suivants', previousYear: 'Année précédente', nextYear: 'Année suivante', previousYears: 'Années précédentes', nextYears: 'Années suivantes', cancel: 'Annuler', apply: 'Appliquer',
    byCategory: 'Dépenses par catégorie', categoryCount: 'catégories', distribution: 'Répartition de', paidOwed: 'Payé et part attribuée par membre', balanceNote: 'Ces montants et soldes portent sur la période choisie ; les soldes courants figurent plus bas.', paidShort: 'Payé', owedShort: 'Part', afterSettlement: 'Solde sur la période après remboursements', noShare: 'Aucune part connue.', spendingTrend: 'Évolution des dépenses', spendingFrom: 'Dépenses de', periodValues: 'Valeurs par période', me: 'Moi', member: 'Membre',
  },
  en: {
    title: 'Group statistics', intro: 'Expenses and repayments in the group currency. Imports without shares are excluded.', group: 'Group', chooseGroup: 'Choose a group', refresh: 'Refresh', spent: 'Group expenses', settled: 'Recorded repayments', paid: 'Paid by me', owed: 'My assigned share', balance: 'My balance for this period', moreMeasures: 'More measures', empty: 'No transactions in this period.', incomplete: 'expense(s) without known shares, excluded from the calculation.', unavailable: 'Statistics unavailable.',
    period: 'Period', choosePeriod: 'Choose a period', periodIntro: 'Select the start and then the end, both inclusive.', close: 'Close period picker', units: 'Period unit', days: 'Days', months: 'Months', years: 'Years', firstBound: 'Choose a start date.', previousMonths: 'Previous months', nextMonths: 'Next months', previousYear: 'Previous year', nextYear: 'Next year', previousYears: 'Previous years', nextYears: 'Next years', cancel: 'Cancel', apply: 'Apply',
    byCategory: 'Expenses by category', categoryCount: 'categories', distribution: 'Breakdown of', paidOwed: 'Paid and assigned share by member', balanceNote: 'These amounts and balances cover the selected period; current balances appear below.', paidShort: 'Paid', owedShort: 'Share', afterSettlement: 'Period balance after repayments', noShare: 'No known shares.', spendingTrend: 'Expense trend', spendingFrom: 'Expenses from', periodValues: 'Values by period', me: 'Me', member: 'Member',
  },
  ja: {
    title: 'グループの統計', intro: '支出と返済をグループの通貨で表示します。分担額不明のインポートは除外します。', group: 'グループ', chooseGroup: 'グループを選択', refresh: '更新', spent: 'グループの支出', settled: '記録された返済', paid: '自分の支払額', owed: '自分の分担額', balance: '選択期間の自分の残高', moreMeasures: 'その他の指標', empty: 'この期間の取引はありません。', incomplete: '件の分担額不明の支出を計算から除外しました。', unavailable: '統計を取得できません。',
    period: '期間', choosePeriod: '期間を選択', periodIntro: '開始と終了を順に選択してください。両端を含みます。', close: '期間選択を閉じる', units: '期間の単位', days: '日', months: '月', years: '年', firstBound: '開始日を選択してください。', previousMonths: '前の月', nextMonths: '次の月', previousYear: '前年', nextYear: '翌年', previousYears: '前の年', nextYears: '次の年', cancel: 'キャンセル', apply: '適用',
    byCategory: 'カテゴリ別の支出', categoryCount: 'カテゴリ', distribution: '合計', paidOwed: 'メンバー別の支払額と分担額', balanceNote: 'ここに表示する金額と残高は選択期間のものです。現在の残高は下に表示します。', paidShort: '支払', owedShort: '分担', afterSettlement: '選択期間の返済後残高', noShare: '分担額はありません。', spendingTrend: '支出の推移', spendingFrom: '支出の期間', periodValues: '期間別の金額', me: '自分', member: 'メンバー',
  },
} as const;

export type StatisticsTextKey = keyof typeof messages.fr;
export function statisticsText(key: StatisticsTextKey): string { return messages[language()][key]; }
