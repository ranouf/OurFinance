import { signal } from '@angular/core';

export type Language = 'fr' | 'en' | 'ja';

export function detectLanguage(languages: readonly string[]): Language {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'fr' || primary === 'en' || primary === 'ja') return primary;
  }
  return 'en';
}

const messages = {
  fr: {
    testEnvironment: 'Environnement de test', offline: 'Hors ligne : les données du serveur sont indisponibles. Reconnectez-vous pour les actualiser et enregistrer des opérations.',
    loadingConfig: 'Chargement de la configuration…', missingConfig: 'L’environnement Firebase de test n’est pas configuré sur ce site.',
    connectedAs: 'Connecté en tant que', verifyEmail: 'Confirmez votre adresse courriel avant d’utiliser les groupes.',
    myGroups: 'Mes groupes', noGroups: 'Aucun groupe disponible.', groupName: 'Nom du groupe', groupCurrency: 'Devise du groupe', createGroup: 'Créer un groupe',
    groupServiceMissing: 'Le service de création de groupes n’est pas encore configuré.', loadingInvites: 'Chargement des invitations…',
    loadingCategories: 'Chargement des catégories…', loadingExpense: 'Chargement du formulaire de dépense…', loadingExpenseHistory: 'Chargement de l’historique des dépenses…',
    loadingSettlement: 'Chargement des remboursements…', loadingSettlementHistory: 'Chargement de l’historique des remboursements…',
    loadingBalances: 'Chargement des soldes…', loadingStatistics: 'Chargement des statistiques…', loadingActivity: 'Chargement de l’activité…',
    loadingExport: 'Chargement de l’export de groupe…', loadingProfile: 'Chargement du profil…', logout: 'Déconnexion',
    testSpace: 'Accédez à votre espace de test.', email: 'Adresse courriel', password: 'Mot de passe', register: 'Créer un compte',
    resetSend: 'Envoyer le lien', login: 'Se connecter', google: 'Continuer avec Google', connection: 'Connexion', signup: 'Inscription', forgotten: 'Mot de passe oublié',
    registerHeading: 'Créer un compte', resetHeading: 'Réinitialiser le mot de passe', welcome: 'Bienvenue',
    verifySent: 'Courriel de vérification envoyé.', resetSent: 'Si ce compte existe, un courriel sera envoyé.', actionFailed: 'Action impossible. Vérifiez les données saisies ou réessayez plus tard.',
    googleFailed: 'Connexion Google impossible.', groupsUnavailable: 'Liste des groupes indisponible.', groupCreateFailed: 'Création du groupe impossible.',
    myProfile: 'Mon profil', profileIntro: 'Ces réglages sont personnels ; la devise dépend de chaque groupe.', displayName: 'Nom affiché', language: 'Langue', timeZone: 'Fuseau horaire', saveProfile: 'Enregistrer le profil',
    signInMethods: 'Méthodes de connexion', googleLinked: 'Google est associé à ce compte.', linkGoogle: 'Associer mon compte Google', profileUnavailable: 'Profil indisponible.', profileSaved: 'Profil enregistré.',
    profileSaveFailed: 'Enregistrement du profil impossible.', googleLinkDone: 'Compte Google associé.', googleInUse: 'Ce compte Google est déjà associé à un autre compte.', googleLinkFailed: 'Association Google impossible. Vérifiez la fenêtre de connexion et réessayez.',
    group: 'Groupe', chooseGroup: 'Choisir un groupe', refresh: 'Actualiser', showMore: 'Afficher plus', me: 'Moi', otherMember: 'Autre membre',
    groupActivity: 'Activité du groupe', noActivity: 'Aucune activité dans ce groupe.', activityRecorded: 'Activité enregistrée',
    expenseCreated: 'Dépense créée', expenseUpdated: 'Dépense modifiée', expenseDeleted: 'Dépense supprimée', settlementRecorded: 'Remboursement déclaré', importCreated: 'Import créé', importUndone: 'Import annulé',
    categoryCreated: 'Catégorie créée', categoryUpdated: 'Catégorie modifiée', categoryArchived: 'Catégorie archivée', categoryReactivated: 'Catégorie réactivée', commentCreated: 'Commentaire ajouté',
    groupBalances: 'Soldes du groupe', balanceIntro: 'Dépenses et remboursements dans la devise du groupe. Les imports historiques sans parts restent exclus.',
    noBalance: 'Aucune opération à répartir dans ce groupe.', unknownShares: 'dépense(s) sans parts connues exclue(s) du calcul.',
    receivable: 'À recevoir', payable: 'À payer', balanced: 'Équilibré', balancesUnavailable: 'Soldes indisponibles.',
    settlementHistory: 'Historique des remboursements', noSettlement: 'Aucun remboursement dans ce groupe.', historyUnavailable: 'Historique indisponible.',
  },
  en: {
    testEnvironment: 'Test environment', offline: 'Offline: server data is unavailable. Reconnect to refresh it and save transactions.',
    loadingConfig: 'Loading configuration…', missingConfig: 'Firebase test configuration is unavailable on this site.',
    connectedAs: 'Signed in as', verifyEmail: 'Verify your email address before using groups.',
    myGroups: 'My groups', noGroups: 'No groups available.', groupName: 'Group name', groupCurrency: 'Group currency', createGroup: 'Create group',
    groupServiceMissing: 'Group creation is not configured yet.', loadingInvites: 'Loading invitations…',
    loadingCategories: 'Loading categories…', loadingExpense: 'Loading expense form…', loadingExpenseHistory: 'Loading expense history…',
    loadingSettlement: 'Loading repayments…', loadingSettlementHistory: 'Loading repayment history…',
    loadingBalances: 'Loading balances…', loadingStatistics: 'Loading statistics…', loadingActivity: 'Loading activity…',
    loadingExport: 'Loading group export…', loadingProfile: 'Loading profile…', logout: 'Sign out',
    testSpace: 'Access your test space.', email: 'Email address', password: 'Password', register: 'Create account',
    resetSend: 'Send link', login: 'Sign in', google: 'Continue with Google', connection: 'Sign in', signup: 'Sign up', forgotten: 'Forgot password',
    registerHeading: 'Create account', resetHeading: 'Reset password', welcome: 'Welcome',
    verifySent: 'Verification email sent.', resetSent: 'If this account exists, an email will be sent.', actionFailed: 'Action failed. Check your details or try again later.',
    googleFailed: 'Google sign-in failed.', groupsUnavailable: 'Group list unavailable.', groupCreateFailed: 'Could not create group.',
    myProfile: 'My profile', profileIntro: 'These settings are personal; each group has its own currency.', displayName: 'Display name', language: 'Language', timeZone: 'Time zone', saveProfile: 'Save profile',
    signInMethods: 'Sign-in methods', googleLinked: 'Google is linked to this account.', linkGoogle: 'Link Google account', profileUnavailable: 'Profile unavailable.', profileSaved: 'Profile saved.',
    profileSaveFailed: 'Could not save profile.', googleLinkDone: 'Google account linked.', googleInUse: 'This Google account is linked to another account.', googleLinkFailed: 'Could not link Google. Check the sign-in window and try again.',
    group: 'Group', chooseGroup: 'Choose a group', refresh: 'Refresh', showMore: 'Show more', me: 'Me', otherMember: 'Another member',
    groupActivity: 'Group activity', noActivity: 'No activity in this group.', activityRecorded: 'Activity recorded',
    expenseCreated: 'Expense created', expenseUpdated: 'Expense updated', expenseDeleted: 'Expense deleted', settlementRecorded: 'Repayment recorded', importCreated: 'Import created', importUndone: 'Import undone',
    categoryCreated: 'Category created', categoryUpdated: 'Category updated', categoryArchived: 'Category archived', categoryReactivated: 'Category reactivated', commentCreated: 'Comment added',
    groupBalances: 'Group balances', balanceIntro: 'Expenses and repayments in the group currency. Historical imports without shares are excluded.',
    noBalance: 'No shared transactions in this group.', unknownShares: 'expense(s) with unknown shares excluded from the calculation.',
    receivable: 'To receive', payable: 'To pay', balanced: 'Balanced', balancesUnavailable: 'Balances unavailable.',
    settlementHistory: 'Repayment history', noSettlement: 'No repayments in this group.', historyUnavailable: 'History unavailable.',
  },
  ja: {
    testEnvironment: 'テスト環境', offline: 'オフラインです。サーバーのデータを利用できません。再接続して更新・保存してください。',
    loadingConfig: '設定を読み込んでいます…', missingConfig: 'このサイトには Firebase のテスト設定がありません。',
    connectedAs: 'ログイン中:', verifyEmail: 'グループを利用する前にメールアドレスを確認してください。',
    myGroups: 'マイグループ', noGroups: '利用できるグループはありません。', groupName: 'グループ名', groupCurrency: 'グループの通貨', createGroup: 'グループを作成',
    groupServiceMissing: 'グループ作成はまだ設定されていません。', loadingInvites: '招待を読み込んでいます…',
    loadingCategories: 'カテゴリを読み込んでいます…', loadingExpense: '支出フォームを読み込んでいます…', loadingExpenseHistory: '支出履歴を読み込んでいます…',
    loadingSettlement: '返済を読み込んでいます…', loadingSettlementHistory: '返済履歴を読み込んでいます…',
    loadingBalances: '残高を読み込んでいます…', loadingStatistics: '統計を読み込んでいます…', loadingActivity: 'アクティビティを読み込んでいます…',
    loadingExport: 'グループのエクスポートを読み込んでいます…', loadingProfile: 'プロフィールを読み込んでいます…', logout: 'ログアウト',
    testSpace: 'テスト環境にアクセスします。', email: 'メールアドレス', password: 'パスワード', register: 'アカウントを作成',
    resetSend: 'リンクを送信', login: 'ログイン', google: 'Google で続行', connection: 'ログイン', signup: '新規登録', forgotten: 'パスワードを忘れた場合',
    registerHeading: 'アカウントを作成', resetHeading: 'パスワードを再設定', welcome: 'ようこそ',
    verifySent: '確認メールを送信しました。', resetSent: 'アカウントが存在する場合、メールを送信します。', actionFailed: '操作できませんでした。入力内容を確認して再試行してください。',
    googleFailed: 'Google ログインに失敗しました。', groupsUnavailable: 'グループ一覧を取得できません。', groupCreateFailed: 'グループを作成できません。',
    myProfile: 'プロフィール', profileIntro: 'この設定は個人用です。通貨はグループごとに決まります。', displayName: '表示名', language: '言語', timeZone: 'タイムゾーン', saveProfile: 'プロフィールを保存',
    signInMethods: 'ログイン方法', googleLinked: 'Google はこのアカウントに連携済みです。', linkGoogle: 'Google アカウントを連携', profileUnavailable: 'プロフィールを取得できません。', profileSaved: 'プロフィールを保存しました。',
    profileSaveFailed: 'プロフィールを保存できません。', googleLinkDone: 'Google アカウントを連携しました。', googleInUse: 'この Google アカウントは別のアカウントに連携されています。', googleLinkFailed: 'Google を連携できません。ログイン画面を確認して再試行してください。',
    group: 'グループ', chooseGroup: 'グループを選択', refresh: '更新', showMore: 'さらに表示', me: '自分', otherMember: '他のメンバー',
    groupActivity: 'グループのアクティビティ', noActivity: 'このグループにはアクティビティがありません。', activityRecorded: 'アクティビティを記録しました',
    expenseCreated: '支出を作成', expenseUpdated: '支出を更新', expenseDeleted: '支出を削除', settlementRecorded: '返済を記録', importCreated: 'インポートを作成', importUndone: 'インポートを取り消し',
    categoryCreated: 'カテゴリを作成', categoryUpdated: 'カテゴリを更新', categoryArchived: 'カテゴリをアーカイブ', categoryReactivated: 'カテゴリを再有効化', commentCreated: 'コメントを追加',
    groupBalances: 'グループの残高', balanceIntro: '支出と返済はグループの通貨で表示します。分担額が不明な過去のインポートは含めません。',
    noBalance: 'このグループに分担対象の取引はありません。', unknownShares: '件の分担額不明の支出を計算から除外しました。',
    receivable: '受取額', payable: '支払額', balanced: '精算済み', balancesUnavailable: '残高を取得できません。',
    settlementHistory: '返済履歴', noSettlement: 'このグループに返済はありません。', historyUnavailable: '履歴を取得できません。',
  },
} as const;

export type MessageKey = keyof typeof messages.fr;
export const language = signal<Language>(detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages));
export const locale = () => ({ fr: 'fr-CA', en: 'en-US', ja: 'ja-JP' })[language()];
export function setLanguage(value: Language): void {
  language.set(value);
  if (typeof document !== 'undefined') document.documentElement.lang = value;
}
export function t(key: MessageKey): string { return messages[language()][key]; }
