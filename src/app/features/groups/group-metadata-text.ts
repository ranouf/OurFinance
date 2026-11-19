import type { Language } from '../../shared/utils/i18n';

export const groupMetadataText = {
  fr: {
    heading: 'Personnaliser le groupe', edit: 'Modifier le groupe', name: 'Nom du groupe', icon: 'Icône', color: 'Couleur',
    description: 'Description', optional: 'Facultatif', none: 'Aucun', save: 'Enregistrer', saved: 'Groupe mis à jour.',
    unavailable: 'Modification indisponible dans cet environnement.', failed: 'Modification impossible. Réessayez.',
    archived: 'Ce groupe archivé est en lecture seule.',
    icons: ['Panier', 'Maison', 'Scolarité', 'Restaurant', 'Transport', 'Santé', 'Loisirs', 'Cadeau', 'Services', 'Autre'],
    colors: ['Sarcelle', 'Bleu', 'Ambre', 'Rose', 'Violet', 'Ardoise'],
  },
  en: {
    heading: 'Customize the group', edit: 'Edit group', name: 'Group name', icon: 'Icon', color: 'Color',
    description: 'Description', optional: 'Optional', none: 'None', save: 'Save', saved: 'Group updated.',
    unavailable: 'Editing is unavailable in this environment.', failed: 'Update failed. Try again.',
    archived: 'This archived group is read-only.',
    icons: ['Cart', 'Home', 'Education', 'Restaurant', 'Transport', 'Health', 'Leisure', 'Gift', 'Services', 'Other'],
    colors: ['Teal', 'Blue', 'Amber', 'Rose', 'Violet', 'Slate'],
  },
  ja: {
    heading: 'グループをカスタマイズ', edit: 'グループを編集', name: 'グループ名', icon: 'アイコン', color: '色',
    description: '説明', optional: '任意', none: 'なし', save: '保存', saved: 'グループを更新しました。',
    unavailable: 'この環境では編集できません。', failed: '更新できませんでした。もう一度お試しください。',
    archived: 'アーカイブされたグループは閲覧専用です。',
    icons: ['買い物', '家', '教育', 'レストラン', '交通', '健康', '娯楽', '贈り物', 'サービス', 'その他'],
    colors: ['青緑', '青', '琥珀', 'ピンク', '紫', '灰'],
  },
} satisfies Record<Language, {
  heading: string; edit: string; name: string; icon: string; color: string; description: string; optional: string; none: string;
  save: string; saved: string; unavailable: string; failed: string; archived: string; icons: string[]; colors: string[];
}>;
