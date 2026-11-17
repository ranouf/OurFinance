import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarComponent } from '../../shared/components/calendar/calendar.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ControlErrorsComponent } from '../../shared/components/control-errors/control-errors.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { FieldComponent } from '../../shared/components/field/field.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { InviteQrCode } from '../../shared/components/invite-qr-code/invite-qr-code';
import { RadioGroupComponent } from '../../shared/components/radio-group/radio-group.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiAccordion } from '../../shared/components/ui-accordion/ui-accordion';
import { UiAvatarStack } from '../../shared/components/ui-avatar-stack/ui-avatar-stack';
import { UiBadge } from '../../shared/components/ui-badge/ui-badge';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { UiDialog } from '../../shared/components/ui-dialog/ui-dialog';
import { UiDonutChart } from '../../shared/components/ui-donut-chart/ui-donut-chart';
import { UiEmptyState } from '../../shared/components/ui-empty-state/ui-empty-state';
import { UiGroupCard } from '../../shared/components/ui-group-card/ui-group-card';
import { UiPagination } from '../../shared/components/ui-pagination/ui-pagination';
import { UiQuickAction } from '../../shared/components/ui-quick-action/ui-quick-action';
import { UiSkeleton } from '../../shared/components/ui-skeleton/ui-skeleton';
import { UiStepper } from '../../shared/components/ui-stepper/ui-stepper';
import { UiSuccessState } from '../../shared/components/ui-success-state/ui-success-state';
import { UiTable } from '../../shared/components/ui-table/ui-table';
import { UiTabs } from '../../shared/components/ui-tabs/ui-tabs';
import { UiTooltip } from '../../shared/components/ui-tooltip/ui-tooltip';
import { language } from '../../shared/utils/i18n';
import { galleryAmount, galleryDate } from './gallery-format';

const galleryText = {
  fr: {
    title: 'Composants de l’interface', intro: 'États et interactions des composants partagés Everyday Pop.', buttons: 'Boutons', primary: 'Enregistrer', secondary: 'Annuler', danger: 'Supprimer', disabled: 'Indisponible', loading: 'Enregistrement…', focus: 'Focus', close: 'Fermer', fields: 'Champs', name: 'Nom du groupe', nameHint: 'Visible par les membres du groupe.', nameError: 'Saisissez un nom de groupe.', email: 'Adresse courriel', emailError: 'Saisissez une adresse courriel valide.', currency: 'Devise du groupe', details: 'Description', alerts: 'Messages', infoTitle: 'Info', successTitle: 'Succès', warningTitle: 'Attention', errorTitle: 'Erreur', info: 'Les changements sont visibles par les membres.', success: 'Enregistrement terminé.', error: 'Impossible d’enregistrer. Réessayez.', badges: 'Badges', active: 'Actif', receivable: 'À recevoir', payable: 'À rembourser', qr: 'Invitation QR', qrLabel: 'Exemple de code QR fictif', copy: 'Copier le lien', share: 'Partager', copied: 'Lien copié.', copyFailed: 'Copie impossible.', patterns: 'Navigation et sélecteur de période', patternsText: 'Le menu ordinateur et mobile encadre cette galerie. Le sélecteur de période est visible dans Statistiques.',
  },
  en: {
    title: 'Interface components', intro: 'States and interactions of shared Everyday Pop components.', buttons: 'Buttons', primary: 'Save', secondary: 'Cancel', danger: 'Delete', disabled: 'Unavailable', loading: 'Saving…', focus: 'Focus', close: 'Close', fields: 'Fields', name: 'Group name', nameHint: 'Visible to group members.', nameError: 'Enter a group name.', email: 'Email address', emailError: 'Enter a valid email address.', currency: 'Group currency', details: 'Description', alerts: 'Messages', infoTitle: 'Info', successTitle: 'Success', warningTitle: 'Warning', errorTitle: 'Error', info: 'Changes are visible to members.', success: 'Saved successfully.', error: 'Unable to save. Try again.', badges: 'Badges', active: 'Active', receivable: 'To receive', payable: 'To repay', qr: 'QR invitation', qrLabel: 'Fictitious QR code example', copy: 'Copy link', share: 'Share', copied: 'Link copied.', copyFailed: 'Could not copy.', patterns: 'Navigation and period picker', patternsText: 'The desktop and mobile navigation surrounds this gallery. The period picker is available in Statistics.',
  },
  ja: {
    title: 'インターフェース部品', intro: '共通部品の状態と操作を確認できます。', buttons: 'ボタン', primary: '保存', secondary: 'キャンセル', danger: '削除', disabled: '利用できません', loading: '保存中…', focus: 'フォーカス', close: '閉じる', fields: '入力欄', name: 'グループ名', nameHint: 'グループのメンバーに表示されます。', nameError: 'グループ名を入力してください。', email: 'メールアドレス', emailError: '有効なメールアドレスを入力してください。', currency: 'グループの通貨', details: '説明', alerts: 'メッセージ', infoTitle: '情報', successTitle: '成功', warningTitle: '注意', errorTitle: 'エラー', info: '変更はメンバーに表示されます。', success: '保存しました。', error: '保存できませんでした。もう一度お試しください。', badges: 'バッジ', active: '有効', receivable: '受け取る', payable: '返済する', qr: 'QR 招待', qrLabel: '架空の QR コード例', copy: 'リンクをコピー', share: '共有', copied: 'リンクをコピーしました。', copyFailed: 'コピーできませんでした。', patterns: 'ナビゲーションと期間選択', patternsText: 'このギャラリーにはデスクトップとモバイルのナビゲーションが表示されます。期間選択は統計画面で確認できます。',
  },
} as const;

const patternText = {
  fr: { tabs: 'Onglets', all: 'Tout', expenses: 'Dépenses', settlements: 'Remboursements', members: 'Membres', navigation: 'Navigation', groups: 'Cartes de groupe', expenseList: 'Liste de dépenses', table: 'Tableau', date: 'Date', label: 'Libellé', category: 'Catégorie', amount: 'Montant', avatars: 'Avatars', pagination: 'Pagination', previous: 'Page précédente', next: 'Page suivante', chart: 'Répartition par catégorie', total: 'Total', accordion: 'Questions fréquentes', sharing: 'Comment fonctionne le partage ?', sharingAnswer: 'Chaque dépense est répartie selon la méthode choisie : parts égales, pourcentage ou montant exact.', currency: 'Puis-je changer la devise ?', currencyAnswer: 'La devise du groupe est fixée dès sa première opération.', empty: 'Aucune dépense pour le moment.', addExpense: 'Ajouter une dépense', qrDialog: 'Invitation par QR', openQr: 'Ouvrir l’invitation', tooltip: 'Infobulle', tooltipLabel: 'Aide sur le partage', tooltipText: 'Répartit le montant entre les membres actifs du groupe.', skeleton: 'Chargement', confirmation: 'État de confirmation', saved: 'Dépense enregistrée !', savedDetail: 'La dépense a bien été ajoutée au groupe.', quickActions: 'Actions rapides', invite: 'Inviter des membres', balance: 'Équilibrer les comptes', exampleFamily: 'Famille fictive' },
  en: { tabs: 'Tabs', all: 'All', expenses: 'Expenses', settlements: 'Settlements', members: 'Members', navigation: 'Navigation', groups: 'Group cards', expenseList: 'Expense list', table: 'Table', date: 'Date', label: 'Label', category: 'Category', amount: 'Amount', avatars: 'Avatars', pagination: 'Pagination', previous: 'Previous page', next: 'Next page', chart: 'By category', total: 'Total', accordion: 'Common questions', sharing: 'How does splitting work?', sharingAnswer: 'Each expense follows its chosen method: equal shares, percentage, or exact amount.', currency: 'Can I change the currency?', currencyAnswer: 'The group currency is fixed after its first transaction.', empty: 'No expenses yet.', addExpense: 'Add an expense', qrDialog: 'QR invitation', openQr: 'Open invitation', tooltip: 'Tooltip', tooltipLabel: 'Splitting help', tooltipText: 'Splits the amount among the active group members.', skeleton: 'Loading', confirmation: 'Confirmation state', saved: 'Expense saved!', savedDetail: 'The expense was added to the group.', quickActions: 'Quick actions', invite: 'Invite members', balance: 'Settle up', exampleFamily: 'Example family' },
  ja: { tabs: 'タブ', all: 'すべて', expenses: '支出', settlements: '返済', members: 'メンバー', navigation: 'ナビゲーション', groups: 'グループカード', expenseList: '支出一覧', table: '表', date: '日付', label: '内容', category: 'カテゴリー', amount: '金額', avatars: 'アバター', pagination: 'ページ送り', previous: '前のページ', next: '次のページ', chart: 'カテゴリー別', total: '合計', accordion: 'よくある質問', sharing: '分割はどう動きますか？', sharingAnswer: '選択した方法に従って、均等、割合、または正確な金額で分割します。', currency: '通貨を変更できますか？', currencyAnswer: '最初の取引後はグループの通貨が固定されます。', empty: '支出はまだありません。', addExpense: '支出を追加', qrDialog: 'QR 招待', openQr: '招待を開く', tooltip: 'ヒント', tooltipLabel: '分割の説明', tooltipText: '金額を有効なグループメンバー間で分割します。', skeleton: '読み込み中', confirmation: '確認状態', saved: '支出を保存しました！', savedDetail: '支出をグループに追加しました。', quickActions: 'クイック操作', invite: 'メンバーを招待', balance: '精算する', exampleFamily: '架空の家族' },
} as const;

const demoText = {
  fr: { defaultField: 'Champ par défaut', focusedField: 'Champ en focus', errorField: 'Champ en erreur', disabledField: 'Champ désactivé', missingAmount: 'Le montant est requis.', includeStatistics: 'Inclure dans les statistiques', errorCategory: 'Catégorie en erreur', selectors: 'Sélecteurs', currency: 'Devise', period: 'Sélecteur de période', days: 'Jours', months: 'Mois', years: 'Années', stepper: 'Quantité', decrease: 'Diminuer', increase: 'Augmenter', exactAmount: 'Montant exact', percentage: 'Pourcentage', paidBy: 'Payé par' },
  en: { defaultField: 'Default field', focusedField: 'Focused field', errorField: 'Field in error', disabledField: 'Disabled field', missingAmount: 'Amount is required.', includeStatistics: 'Include in statistics', errorCategory: 'Category error state', selectors: 'Selectors', currency: 'Currency', period: 'Period selector', days: 'Days', months: 'Months', years: 'Years', stepper: 'Quantity', decrease: 'Decrease', increase: 'Increase', exactAmount: 'Exact amount', percentage: 'Percentage', paidBy: 'Paid by' },
  ja: { defaultField: '通常の入力欄', focusedField: 'フォーカス中', errorField: 'エラーの入力欄', disabledField: '無効な入力欄', missingAmount: '金額を入力してください。', includeStatistics: '統計に含める', errorCategory: 'カテゴリーのエラー状態', selectors: 'セレクター', currency: '通貨', period: '期間', days: '日', months: '月', years: '年', stepper: '数量', decrease: '減らす', increase: '増やす', exactAmount: '正確な金額', percentage: '割合', paidBy: '支払った人' },
} as const;

const formText = {
  fr: { inputs: 'Types de saisie', text: 'Texte', number: 'Nombre', email: 'Courriel', phone: 'Téléphone', password: 'Mot de passe', search: 'Recherche', url: 'Adresse Web', date: 'Date', time: 'Heure', select: 'Sélection', textarea: 'Texte multiligne', controls: 'Choix', checkbox: 'Afficher les dépenses du groupe', toggle: 'Recevoir les rappels', radio: 'Mode de partage', equal: 'Parts égales', exact: 'Montants exacts', calendar: 'Calendrier' },
  en: { inputs: 'Input types', text: 'Text', number: 'Number', email: 'Email', phone: 'Phone', password: 'Password', search: 'Search', url: 'Web address', date: 'Date', time: 'Time', select: 'Select', textarea: 'Multiline text', controls: 'Choices', checkbox: 'Show group expenses', toggle: 'Receive reminders', radio: 'Split mode', equal: 'Equal shares', exact: 'Exact amounts', calendar: 'Calendar' },
  ja: { inputs: '入力の種類', text: 'テキスト', number: '数値', email: 'メール', phone: '電話', password: 'パスワード', search: '検索', url: 'ウェブアドレス', date: '日付', time: '時刻', select: '選択', textarea: '複数行テキスト', controls: '選択', checkbox: 'グループの支出を表示', toggle: '通知を受け取る', radio: '分割方法', equal: '均等割り', exact: '正確な金額', calendar: 'カレンダー' },
} as const;

const kitText = {
  fr: { foundations: 'Fondations et actions', foundationsIntro: 'Couleurs, typographie, boutons et états d’interface.', palette: 'Palette de couleurs', typography: 'Typographie', primary: 'Primaire', primaryDark: 'Primaire foncé', coral: 'Corail', sun: 'Jaune', mint: 'Menthe', lavender: 'Lavande', surface: 'Surface', border: 'Bordure', title: 'Titre principal', section: 'Titre de section', card: 'Titre de carte', body: 'Texte courant', action: 'Action', outline: 'Contour', ghost: 'Discret', warning: 'Vérifiez les données.', forms: 'Formulaires et sélection', formsIntro: 'Champs, sélecteurs, contrôles et exemple de formulaire.', example: 'Exemple : ajouter une dépense', expense: 'Dîner entre amis', amount: 'Montant', category: 'Catégorie', payer: 'Payé par', split: 'Répartition', addExpense: 'Ajouter la dépense', patterns: 'Navigation, données et détails', patternsIntro: 'Cartes, listes, tableaux et états d’information.', groupCard: 'Carte de groupe', expenseList: 'Liste de dépenses', family: 'Famille fictive', members: 'membres', travel: 'Voyage fictif', restaurant: 'Restaurant fictif', groceries: 'Épicerie fictive', empty: 'Aucune dépense pour le moment.', business: 'Composants métier', businessIntro: 'Présentation des dépenses, groupes et répartitions.', responsive: 'Responsive et tokens', responsiveIntro: 'Les mêmes contrôles restent utilisables à 320, 390 et 1280 px.', guides: 'Guides et bonnes pratiques', guidesIntro: 'Libellés visibles, focus perceptible, erreurs en texte et exemples fictifs.' },
  en: { foundations: 'Foundations and actions', foundationsIntro: 'Colors, typography, buttons and interface states.', palette: 'Color palette', typography: 'Typography', primary: 'Primary', primaryDark: 'Dark primary', coral: 'Coral', sun: 'Yellow', mint: 'Mint', lavender: 'Lavender', surface: 'Surface', border: 'Border', title: 'Main heading', section: 'Section heading', card: 'Card heading', body: 'Body text', action: 'Action', outline: 'Outline', ghost: 'Subtle', warning: 'Check the information.', forms: 'Forms and selection', formsIntro: 'Fields, selectors, controls and a form example.', example: 'Example: add an expense', expense: 'Dinner with friends', amount: 'Amount', category: 'Category', payer: 'Paid by', split: 'Split', addExpense: 'Add expense', patterns: 'Navigation, data and details', patternsIntro: 'Cards, lists, tables and information states.', groupCard: 'Group card', expenseList: 'Expense list', family: 'Example family', members: 'members', travel: 'Example trip', restaurant: 'Example restaurant', groceries: 'Example groceries', empty: 'No expenses yet.', business: 'Business components', businessIntro: 'Expense, group and split views.', responsive: 'Responsive and tokens', responsiveIntro: 'The same controls work at 320, 390 and 1280 px.', guides: 'Guides and good practices', guidesIntro: 'Visible labels, clear focus, text errors and fictitious examples.' },
  ja: { foundations: '基本と操作', foundationsIntro: '色、書体、ボタン、画面の状態。', palette: 'カラーパレット', typography: 'タイポグラフィ', primary: 'メイン', primaryDark: '濃いメイン', coral: 'コーラル', sun: '黄色', mint: 'ミント', lavender: 'ラベンダー', surface: '背景', border: '境界線', title: '大見出し', section: 'セクション見出し', card: 'カード見出し', body: '本文', action: '操作', outline: '輪郭', ghost: '控えめ', warning: '情報を確認してください。', forms: 'フォームと選択', formsIntro: '入力欄、選択、操作、フォーム例。', example: '例：支出を追加', expense: '友人との夕食', amount: '金額', category: 'カテゴリー', payer: '支払者', split: '分割', addExpense: '支出を追加', patterns: 'ナビゲーションとデータ', patternsIntro: 'カード、一覧、表、情報の状態。', groupCard: 'グループカード', expenseList: '支出一覧', family: '家族の例', members: '人のメンバー', travel: '旅行の例', restaurant: 'レストランの例', groceries: '食料品の例', empty: '支出はまだありません。', business: '業務部品', businessIntro: '支出、グループ、分割の表示。', responsive: 'レスポンシブとトークン', responsiveIntro: '320、390、1280 px でも操作できます。', guides: 'ガイドと実践', guidesIntro: '見えるラベル、明確なフォーカス、文字によるエラー、架空の例。' },
} as const;

@Component({
  selector: 'app-gallery',
  imports: [CalendarComponent, CheckboxComponent, ControlErrorsComponent, DropdownComponent, FieldComponent, InputComponent, InviteQrCode, RadioGroupComponent, ReactiveFormsModule, SelectComponent, TextareaComponent, ToggleComponent, UiAccordion, UiAlert, UiAvatarStack, UiBadge, UiButton, UiDialog, UiDonutChart, UiEmptyState, UiGroupCard, UiPagination, UiQuickAction, UiSkeleton, UiStepper, UiSuccessState, UiTable, UiTabs, UiTooltip],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {
  readonly language = language;
  readonly text = galleryText;
  readonly formText = formText;
  readonly kitText = kitText;
  readonly patternText = patternText;
  readonly demoText = demoText;
  readonly demoAmount = galleryAmount;
  readonly demoDate = galleryDate;
  activeTab = 'all';
  activePage = 1;
  activePeriod = 'months';
  activeSplit = 'equal';
  quantity = 2;
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
  readonly checkboxOffControl = new FormControl(false);
  readonly toggleControl = new FormControl(false);
  readonly radioControl = new FormControl('equal');
  readonly calendarControl = new FormControl('2026-11-17');
  readonly exampleDescription = new FormControl('Dîner entre amis');
  readonly exampleAmount = new FormControl<number | null>(86.40);
  readonly exampleCategory = new FormControl('restaurant');
  readonly disabledControl = new FormControl({ value: '', disabled: true });
  readonly examplePayer = new FormControl('Alex');
  readonly fieldDefaultControl = new FormControl('Ma dépense');
  readonly fieldFocusControl = new FormControl('Ma dépense');
  readonly fieldErrorControl = new FormControl('', [Validators.required]);
  readonly selectorCategory = new FormControl('restaurant');
  readonly selectorErrorCategory = new FormControl('', [Validators.required]);

  constructor() { this.emailControl.markAsTouched(); this.fieldErrorControl.markAsTouched(); this.selectorErrorCategory.markAsTouched(); }
}
