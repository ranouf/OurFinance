import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { language } from '../../shared/utils/i18n';

const labels = {
  fr: { nav: 'Composants', buttons: 'Boutons', fields: 'Champs', inputs: 'Saisies', choices: 'Choix', calendar: 'Calendrier', alerts: 'Messages', badges: 'Badges', qr: 'Invitation QR', navigation: 'Navigation' },
  en: { nav: 'Components', buttons: 'Buttons', fields: 'Fields', inputs: 'Inputs', choices: 'Choices', calendar: 'Calendar', alerts: 'Messages', badges: 'Badges', qr: 'QR invitation', navigation: 'Navigation' },
  ja: { nav: '部品', buttons: 'ボタン', fields: '入力欄', inputs: '入力', choices: '選択', calendar: 'カレンダー', alerts: 'メッセージ', badges: 'バッジ', qr: 'QR 招待', navigation: 'ナビゲーション' },
} as const;

@Component({
  selector: 'app-gallery-layout',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './gallery-layout.component.html',
})
export class GalleryLayoutComponent {
  readonly language = language;
  readonly labels = labels;
}
