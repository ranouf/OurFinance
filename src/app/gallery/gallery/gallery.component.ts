import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarComponent } from '../../shared/components/calendar/calendar.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ControlErrorsComponent } from '../../shared/components/control-errors/control-errors.component';
import { FieldComponent } from '../../shared/components/field/field.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { InviteQrCode } from '../../shared/components/invite-qr-code/invite-qr-code';
import { RadioGroupComponent } from '../../shared/components/radio-group/radio-group.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
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

const formText = {
  fr: { inputs: 'Types de saisie', text: 'Texte', number: 'Nombre', email: 'Courriel', phone: 'Téléphone', password: 'Mot de passe', search: 'Recherche', url: 'Adresse Web', date: 'Date', time: 'Heure', select: 'Sélection', textarea: 'Texte multiligne', controls: 'Choix', checkbox: 'Afficher les dépenses du groupe', toggle: 'Recevoir les rappels', radio: 'Mode de partage', equal: 'Parts égales', exact: 'Montants exacts', calendar: 'Calendrier' },
  en: { inputs: 'Input types', text: 'Text', number: 'Number', email: 'Email', phone: 'Phone', password: 'Password', search: 'Search', url: 'Web address', date: 'Date', time: 'Time', select: 'Select', textarea: 'Multiline text', controls: 'Choices', checkbox: 'Show group expenses', toggle: 'Receive reminders', radio: 'Split mode', equal: 'Equal shares', exact: 'Exact amounts', calendar: 'Calendar' },
  ja: { inputs: '入力の種類', text: 'テキスト', number: '数値', email: 'メール', phone: '電話', password: 'パスワード', search: '検索', url: 'ウェブアドレス', date: '日付', time: '時刻', select: '選択', textarea: '複数行テキスト', controls: '選択', checkbox: 'グループの支出を表示', toggle: '通知を受け取る', radio: '分割方法', equal: '均等割り', exact: '正確な金額', calendar: 'カレンダー' },
} as const;

@Component({
  selector: 'app-gallery',
  imports: [CalendarComponent, CheckboxComponent, ControlErrorsComponent, FieldComponent, InputComponent, InviteQrCode, RadioGroupComponent, ReactiveFormsModule, SelectComponent, TextareaComponent, ToggleComponent, UiAlert, UiBadge, UiButton, UiField],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {
  readonly language = language;
  readonly text = galleryText;
  readonly formText = formText;
  readonly textControl = new FormControl('Famille fictive');
  readonly numberControl = new FormControl<number | null>(42);
  readonly emailControl = new FormControl('incorrect', [Validators.email]);
  readonly phoneControl = new FormControl('555-0100');
  readonly passwordControl = new FormControl('exemple123');
  readonly searchControl = new FormControl('Restaurant');
  readonly urlControl = new FormControl('https://example.invalid');
  readonly dateControl = new FormControl('2026-11-17');
  readonly timeControl = new FormControl('12:30');
  readonly selectControl = new FormControl('cad');
  readonly textareaControl = new FormControl('Dépense fictive pour la démonstration.');
  readonly checkboxControl = new FormControl(true);
  readonly toggleControl = new FormControl(false);
  readonly radioControl = new FormControl('equal');
  readonly calendarControl = new FormControl('2026-11-17');

  constructor() { this.emailControl.markAsTouched(); }
}
