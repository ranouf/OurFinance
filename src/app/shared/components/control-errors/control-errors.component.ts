import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { language } from '../../utils/i18n';

const defaults = {
  fr: { required: 'Ce champ est obligatoire.', requiredTrue: 'Confirmez ce choix.', email: 'Saisissez une adresse courriel valide.', min: 'La valeur est trop petite.', max: 'La valeur est trop grande.', minlength: 'Le texte est trop court.', maxlength: 'Le texte est trop long.', pattern: 'Le format est invalide.' },
  en: { required: 'This field is required.', requiredTrue: 'Confirm this choice.', email: 'Enter a valid email address.', min: 'The value is too small.', max: 'The value is too large.', minlength: 'The text is too short.', maxlength: 'The text is too long.', pattern: 'The format is invalid.' },
  ja: { required: 'この項目は必須です。', requiredTrue: 'この選択を確認してください。', email: '有効なメールアドレスを入力してください。', min: '値が小さすぎます。', max: '値が大きすぎます。', minlength: '文字数が足りません。', maxlength: '文字数が多すぎます。', pattern: '形式が正しくありません。' },
} as const;

@Component({
  selector: 'app-control-errors',
  templateUrl: './control-errors.component.html',
})
export class ControlErrorsComponent {
  @Input({ required: true }) errorId = '';
  @Input() control: AbstractControl | null = null;
  @Input() messages: Record<string, string> = {};
  get message(): string | null {
    if (!this.control?.invalid || (!this.control.touched && !this.control.dirty)) return null;
    const key = Object.keys(this.control.errors ?? {})[0];
    return key ? this.messages[key] ?? defaults[language()][key as keyof typeof defaults.fr] ?? null : null;
  }
}
