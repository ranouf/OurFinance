import type { Language } from '../../shared/utils/i18n';

export const groupsPageText = {
  fr: { hero: 'Les dépenses ensemble', heroHelp: 'Retrouve tes proches et tes comptes au même endroit.', create: 'Créer un groupe', back: 'Retour aux groupes', list: 'Tous mes groupes', archived: 'Groupes archivés', active: 'Actif', readOnly: 'Lecture seule', join: 'Rejoindre par lien', members: 'Membres', status: 'État', sections: 'Sections du groupe', overview: 'Aperçu', categories: 'Catégories', settings: 'Paramètres', export: 'Exporter l’historique' },
  en: { hero: 'Expenses together', heroHelp: 'Keep your people and shared balances in one place.', create: 'Create a group', back: 'Back to groups', list: 'All my groups', archived: 'Archived groups', active: 'Active', readOnly: 'Read only', join: 'Join by link', members: 'Members', status: 'Status', sections: 'Group sections', overview: 'Overview', categories: 'Categories', settings: 'Settings', export: 'Export history' },
  ja: { hero: '一緒に支出を管理', heroHelp: '仲間と共有の残高を一か所で確認できます。', create: 'グループを作成', back: 'グループ一覧に戻る', list: 'すべてのグループ', archived: 'アーカイブ済み', active: '有効', readOnly: '閲覧のみ', join: 'リンクで参加', members: 'メンバー', status: '状態', sections: 'グループの項目', overview: '概要', categories: 'カテゴリ', settings: '設定', export: '履歴をエクスポート' },
} satisfies Record<Language, Record<string, string>>;
