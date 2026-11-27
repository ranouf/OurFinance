import { UiControlDirective } from './shared/components/ui-field/ui-control.directive';
import { UiButton } from './shared/components/ui-button/ui-button';
import { UiAlert } from './shared/components/ui-alert/ui-alert';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { App } from './app';
import { t } from './shared/utils/i18n';
@Component({
  selector: 'app-login-page',
  imports: [FormsModule, UiControlDirective, UiButton, UiAlert],
  template: `
    <div class="login-page mx-auto max-w-5xl overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_50px_#30275214] lg:grid lg:min-h-[690px] lg:grid-cols-[1.08fr_1fr]">
      <div class="relative overflow-hidden bg-pop-primary">
        <div class="flex items-center gap-2 bg-white px-5 py-4 lg:hidden"><img src="/illustrations/ourfinance-mark.svg" width="36" height="36" alt="" /><span class="text-xl font-black tracking-tight text-pop-text">ourfinance<span class="text-pop-sun">.</span></span></div>
        <picture><source media="(min-width: 1024px)" srcset="/illustrations/cafe-hero.webp" /><img class="h-[335px] w-full object-cover object-[center_65%] sm:h-[420px] lg:h-full lg:min-h-[690px] lg:object-center" src="/illustrations/cafe-hero.webp" alt="" /></picture>
      </div>
      <div class="px-5 py-7 max-[240px]:px-1 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div class="mb-7 hidden items-center gap-2 lg:flex"><img src="/illustrations/ourfinance-mark.svg" width="41" height="41" alt="" /><span class="text-2xl font-black tracking-tight text-pop-text">ourfinance<span class="text-pop-sun">.</span></span></div>
        @if (app.invalidInvite()) {
          <section class="rounded-3xl border border-pop-border bg-white p-6 shadow-sm" role="alert"><h1 class="text-2xl font-black">{{ t('invitationLinkInvalid') }}</h1><app-ui-button variant="secondary" class="mt-4" type="button" (click)="app.declineInvite()">{{ app.qrText().decline }}</app-ui-button></section>
        } @else if (app.pendingInvite() && !app.auth?.user() && !showInviteAuth()) {
          <section class="rounded-3xl border border-pop-border bg-white p-5 shadow-sm sm:p-7" [attr.aria-label]="app.qrText().received">
            <span class="flex size-14 items-center justify-center rounded-2xl bg-pop-lavender text-pop-primary-dark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
            <p class="mt-4 font-extrabold text-pop-primary-dark">{{ app.qrText().received }}</p>
            <h1 class="mt-2 text-3xl font-black leading-tight">{{ t('inviteGuestHeading') }}</h1>
            <p class="mt-3 text-pop-muted">{{ app.qrText().signIn }}</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2"><app-ui-button variant="primary" type="button" (click)="showInviteAuth.set(true); app.mode.set('login')">{{ t('login') }}</app-ui-button><app-ui-button variant="secondary" type="button" (click)="showInviteAuth.set(true); app.mode.set('register')">{{ t('register') }}</app-ui-button></div>
            <app-ui-button variant="ghost" class="mt-4" type="button" (click)="app.declineInvite()">{{ app.qrText().decline }}</app-ui-button>
          </section>
        } @else {
        <h1 class="text-2xl font-black leading-tight sm:text-3xl">@if (app.mode() === 'login') { <span class="lg:hidden">{{ t('welcomeMobile') }}</span><span class="hidden lg:inline">{{ app.heading() }}</span> 👋 } @else { {{ app.heading() }} }</h1>
        <p class="mt-1 text-sm text-pop-muted">{{ t('loginIntro') }}</p>
        @if (app.pendingInvite()) {
          <aside class="mt-4 rounded-xl bg-pop-lavender p-3 text-sm" role="status"><strong>{{ app.qrText().received }}</strong> {{ app.qrText().signIn }}
            <app-ui-button variant="ghost" class="ml-2" type="button" (click)="app.declineInvite()"><span class="underline">{{ app.qrText().decline }}</span></app-ui-button>
          </aside>
        }
        @if (app.auth?.user(); as user) {
          <p class="mt-4 break-all text-sm text-pop-muted">{{ t('connectedAs') }} {{ user.email }}.</p>
          @if (!user.emailVerified) {
            <app-ui-alert variant="warning" class="mt-4">{{ t('verifyEmail') }}</app-ui-alert>
            <div class="mt-3 flex flex-wrap gap-2">
              <app-ui-button variant="primary" type="button" [disabled]="app.busy()" (click)="app.refreshVerification()">{{ app.qrText().refreshVerification }}</app-ui-button>
              <app-ui-button variant="outline" type="button" [disabled]="app.busy()" (click)="app.resendVerification()">{{ app.qrText().resendVerification }}</app-ui-button>
            </div>
          }
          <app-ui-button variant="ghost" class="mt-5" type="button" (click)="app.logout()"><span class="underline">{{ t('logout') }}</span></app-ui-button>
        } @else {
          @if (app.mode() !== 'login') {
            <div class="mt-4 flex gap-2 text-sm"><app-ui-button variant="ghost" type="button" (click)="app.mode.set('login')"><span class="underline">{{ t('connection') }}</span></app-ui-button></div>
          }
          <form class="mt-5 space-y-4" novalidate (ngSubmit)="submit()">
            <div><label class="block text-sm font-bold" for="login-email">{{ t('email') }}</label><span class="relative mt-1 block"><svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pop-primary-dark" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></svg><input appUiControl #emailInput id="login-email" class="!pl-10" type="email" name="email" autocomplete="email" [(ngModel)]="app.email" [attr.aria-invalid]="emailInvalid()" [attr.aria-describedby]="emailInvalid() ? 'login-email-error' : app.message() ? 'login-auth-message' : null" required /></span>@if (emailInvalid()) { <p id="login-email-error" role="alert" class="mt-1 text-xs font-bold text-rose-700">{{ t('emailInvalid') }}</p> }</div>
            @if (app.mode() !== 'reset') {
              <div><label class="block text-sm font-bold" for="login-password">{{ t('password') }}</label>
                <span class="mt-1 flex max-[240px]:flex-col rounded-xl border border-pop-border bg-pop-background focus-within:outline-2 focus-within:outline-pop-primary" [class.border-rose-600]="passwordInvalid()">
                  <svg class="ml-3 shrink-0 self-center max-[240px]:hidden text-pop-primary-dark" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  <input appUiControl [plain]="true" #passwordInput id="login-password" class="min-w-0 flex-1 px-2 outline-none max-[240px]:flex-none" [type]="app.showPassword() ? 'text' : 'password'" name="password" [autocomplete]="app.mode() === 'register' ? 'new-password' : 'current-password'" [(ngModel)]="app.password" [attr.aria-invalid]="passwordInvalid()" [attr.aria-describedby]="passwordInvalid() ? 'login-password-error' : app.message() ? 'login-auth-message' : null" required />
                  <button class="flex min-h-11 min-w-11 items-center justify-center px-3 max-[240px]:self-end text-pop-primary-dark" type="button" (click)="app.showPassword.update(value => !value)" [attr.aria-label]="app.showPassword() ? t('hidePassword') : t('showPassword')"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button>
                </span>
                @if (passwordInvalid()) { <p id="login-password-error" role="alert" class="mt-1 text-xs font-bold text-rose-700">{{ t('passwordRequired') }}</p> }
              </div>
            }
            @if (app.mode() === 'login') { <app-ui-button variant="ghost" class="flex w-full justify-end" size="sm" type="button" (click)="app.mode.set('reset')">{{ t('forgotten') }}</app-ui-button> }
            <app-ui-button variant="coral" size="lg" [block]="true" class="w-full" [disabled]="app.busy() || !app.online()" type="submit">{{ app.mode() === 'register' ? t('register') : app.mode() === 'reset' ? t('resetSend') : t('login') }}</app-ui-button>
          </form>
          @if (app.mode() === 'login') {
            <div class="my-3 flex items-center gap-3 text-xs text-pop-muted"><span class="h-px flex-1 bg-pop-border"></span>{{ t('or') }}<span class="h-px flex-1 bg-pop-border"></span></div>
            <app-ui-button variant="secondary" size="lg" [block]="true" class="w-full" type="button" [disabled]="app.busy() || !app.online()" (click)="app.google()"><span class="bg-gradient-to-br from-blue-600 via-red-500 to-green-600 bg-clip-text text-xl font-black text-transparent" aria-hidden="true">G</span>{{ t('google') }}</app-ui-button>
            <p class="mt-4 text-center text-sm text-pop-muted">{{ t('newHere') }} <app-ui-button variant="ghost" type="button" (click)="app.mode.set('register')"><span class="underline">{{ t('signup') }}</span></app-ui-button></p>
          }
        }
        @if (app.message()) { <app-ui-alert [variant]="messageVariant()" id="login-auth-message" class="mt-4">{{ app.message() }}</app-ui-alert> }
        }
      </div>
    </div>
  `,
})
export class LoginPage {
  readonly app = inject(App);
  readonly t = t;
  readonly submitted = signal(false);
  readonly showInviteAuth = signal(false);
  messageVariant(): 'success' | 'error' { return this.app.message() === t('verifySent') || this.app.message() === t('resetSent') ? 'success' : 'error'; }
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
