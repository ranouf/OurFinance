import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginPage {
  readonly app = inject(App);
  readonly t = t;
  readonly submitted = signal(false);
  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;
  emailInvalid(): boolean { return this.submitted() && !this.emailInput?.nativeElement.validity.valid; }
  passwordInvalid(): boolean { return this.submitted() && this.app.mode() !== 'reset' && !this.app.password; }
  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.emailInvalid()) { this.emailInput?.nativeElement.focus(); return; }
    if (this.passwordInvalid()) { this.passwordInput?.nativeElement.focus(); return; }
    await this.app.submit();
  }
}
