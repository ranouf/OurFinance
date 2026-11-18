import type { Language } from '../../shared/utils/i18n';

export const groupLifecycleText = {
  fr: {
    heading: 'Membres et accès', owner: 'Propriétaire', member: 'Membre', you: 'Vous', active: 'Actif', revoked: 'Révoqué',
    revoke: 'Révoquer', revokeConfirm: 'Confirmer la révocation', archive: 'Archiver le groupe', archiveConfirm: 'Confirmer l’archivage', cancel: 'Annuler',
    revokeWarning: 'Ce membre perdra immédiatement l’accès au groupe. Les dépenses et dettes historiques seront conservées.',
    archiveWarning: 'Le groupe deviendra accessible en lecture seule. Ses opérations et reçus resteront dans l’historique ; le propriétaire pourra exporter une sauvegarde.',
    archived: 'Groupe archivé : historique en lecture seule.', exportHistory: 'Exporter l’historique', empty: 'Aucun membre actif.', loading: 'Chargement des membres…', unavailable: 'Membres indisponibles.',
    actionUnavailable: 'Action indisponible sur cet environnement.', actionFailed: 'Action impossible. Actualisez le groupe et réessayez.',
  },
  en: {
    heading: 'Members and access', owner: 'Owner', member: 'Member', you: 'You', active: 'Active', revoked: 'Revoked',
    revoke: 'Revoke', revokeConfirm: 'Confirm revocation', archive: 'Archive group', archiveConfirm: 'Confirm archive', cancel: 'Cancel',
    revokeWarning: 'This member will immediately lose access to the group. Historical expenses and debts will remain.',
    archiveWarning: 'The group will become read-only. Its operations and receipts will remain in history; the owner can export a backup.',
    archived: 'Archived group: read-only history.', exportHistory: 'Export history', empty: 'No active members.', loading: 'Loading members…', unavailable: 'Members unavailable.',
    actionUnavailable: 'Action unavailable in this environment.', actionFailed: 'Action failed. Refresh the group and try again.',
  },
  ja: {
    heading: 'メンバーとアクセス', owner: '所有者', member: 'メンバー', you: 'あなた', active: '有効', revoked: '解除済み',
    revoke: '参加を解除', revokeConfirm: '解除を確定', archive: 'グループをアーカイブ', archiveConfirm: 'アーカイブを確定', cancel: 'キャンセル',
    revokeWarning: 'このメンバーは直ちにグループにアクセスできなくなります。過去の支出と債務は保持されます。',
    archiveWarning: 'グループは読み取り専用になります。取引と領収書は履歴に残り、所有者はバックアップをエクスポートできます。',
    archived: 'アーカイブ済みグループ：履歴は読み取り専用です。', exportHistory: '履歴をエクスポート', empty: '有効なメンバーはいません。', loading: 'メンバーを読み込み中…', unavailable: 'メンバーを読み込めません。',
    actionUnavailable: 'この環境では操作できません。', actionFailed: '操作できませんでした。グループを更新して再試行してください。',
  },
} satisfies Record<Language, Record<string, string>>;
