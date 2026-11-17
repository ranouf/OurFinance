import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { language } from '../../shared/utils/i18n';

const labels = {
  fr: { nav: 'Navigation des composants', components: 'Composants', foundations: 'Fondations et actions', forms: 'Formulaires et sélection', patterns: 'Navigation et données', business: 'Composants métier', responsive: 'Responsive et tokens', guides: 'Guides et pratiques', buttons: 'Boutons', fields: 'Champs', inputs: 'Saisies', choices: 'Choix', calendar: 'Calendrier', alerts: 'Messages', badges: 'Badges', qr: 'Invitation QR' },
  en: { nav: 'Component navigation', components: 'Components', foundations: 'Foundations and actions', forms: 'Forms and selection', patterns: 'Navigation and data', business: 'Business components', responsive: 'Responsive and tokens', guides: 'Guides and practices', buttons: 'Buttons', fields: 'Fields', inputs: 'Inputs', choices: 'Choices', calendar: 'Calendar', alerts: 'Messages', badges: 'Badges', qr: 'QR invitation' },
  ja: { nav: '部品ナビゲーション', components: '部品', foundations: '基本と操作', forms: 'フォームと選択', patterns: 'ナビゲーションとデータ', business: '業務部品', responsive: 'レスポンシブとトークン', guides: 'ガイドと実践', buttons: 'ボタン', fields: '入力欄', inputs: '入力', choices: '選択', calendar: 'カレンダー', alerts: 'メッセージ', badges: 'バッジ', qr: 'QR 招待' },
} as const;

@Component({
  selector: 'app-gallery-layout',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './gallery-layout.component.html',
})
export class GalleryLayoutComponent {
  readonly language = language;
  readonly labels = labels;
  activeSection = 'foundations';
}
