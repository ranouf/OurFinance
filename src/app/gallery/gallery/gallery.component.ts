import { Component } from '@angular/core';
import { InviteQrCode } from '../../shared/components/invite-qr-code/invite-qr-code';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiBadge } from '../../shared/components/ui-badge/ui-badge';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { UiField } from '../../shared/components/ui-field/ui-field';
import { language } from '../../shared/utils/i18n';

const galleryText = {
  fr: {
    title: 'Composants de l’interface', intro: 'États et interactions des composants partagés Everyday Pop.', buttons: 'Boutons', primary: 'Enregistrer', secondary: 'Annuler', danger: 'Supprimer', disabled: 'Indisponible', loading: 'Enregistrement…', fields: 'Champs', name: 'Nom du groupe', nameHint: 'Visible par les membres du groupe.', nameError: 'Saisissez un nom de groupe.', email: 'Adresse courriel', emailError: 'Saisissez une adresse courriel valide.', currency: 'Devise du groupe', details: 'Description', alerts: 'Messages', info: 'Les changements sont visibles par les membres.', success: 'Enregistrement terminé.', error: 'Impossible d’enregistrer. Réessayez.', badges: 'Badges', active: 'Actif', receivable: 'À recevoir', payable: 'À rembourser', qr: 'Invitation QR', qrLabel: 'Exemple de code QR fictif', copy: 'Copier le lien', share: 'Partager', copied: 'Lien copié.', copyFailed: 'Copie impossible.', patterns: 'Navigation et sélecteur de période', patternsText: 'Le menu ordinateur et mobile encadre cette galerie. Le sélecteur de période est visible dans Statistiques.',
  },
  en: {
    title: 'Interface components', intro: 'States and interactions of shared Everyday Pop components.', buttons: 'Buttons', primary: 'Save', secondary: 'Cancel', danger: 'Delete', disabled: 'Unavailable', loading: 'Saving…', fields: 'Fields', name: 'Group name', nameHint: 'Visible to group members.', nameError: 'Enter a group name.', email: 'Email address', emailError: 'Enter a valid email address.', currency: 'Group currency', details: 'Description', alerts: 'Messages', info: 'Changes are visible to members.', success: 'Saved successfully.', error: 'Unable to save. Try again.', badges: 'Badges', active: 'Active', receivable: 'To receive', payable: 'To repay', qr: 'QR invitation', qrLabel: 'Fictitious QR code example', copy: 'Copy link', share: 'Share', copied: 'Link copied.', copyFailed: 'Could not copy.', patterns: 'Navigation and period picker', patternsText: 'The desktop and mobile navigation surrounds this gallery. The period picker is available in Statistics.',
  },
  ja: {
    title: 'インターフェース部品', intro: '共通部品の状態と操作を確認できます。', buttons: 'ボタン', primary: '保存', secondary: 'キャンセル', danger: '削除', disabled: '利用できません', loading: '保存中…', fields: '入力欄', name: 'グループ名', nameHint: 'グループのメンバーに表示されます。', nameError: 'グループ名を入力してください。', email: 'メールアドレス', emailError: '有効なメールアドレスを入力してください。', currency: 'グループの通貨', details: '説明', alerts: 'メッセージ', info: '変更はメンバーに表示されます。', success: '保存しました。', error: '保存できませんでした。もう一度お試しください。', badges: 'バッジ', active: '有効', receivable: '受け取る', payable: '返済する', qr: 'QR 招待', qrLabel: '架空の QR コード例', copy: 'リンクをコピー', share: '共有', copied: 'リンクをコピーしました。', copyFailed: 'コピーできませんでした。', patterns: 'ナビゲーションと期間選択', patternsText: 'このギャラリーにはデスクトップとモバイルのナビゲーションが表示されます。期間選択は統計画面で確認できます。',
  },
} as const;

@Component({
  selector: 'app-gallery',
  imports: [InviteQrCode, UiAlert, UiBadge, UiButton, UiField],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {
  readonly language = language;
  readonly text = galleryText;
}
