import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { QrInvitationService, QrInviteRequestError, type QrInvitePreview } from '../../core/firebase/qr-invitation-service';
import { language, locale } from '../../shared/utils/i18n';
import { qrInvitationText } from './qr-invitation-text';

@Component({
  selector: 'app-invite-acceptance-card', imports: [UiButton, UiAlert],
  template: `
    <section class="rounded-3xl border border-pop-border bg-white p-6 shadow-sm sm:p-8" [attr.aria-label]="text().received">
      <span class="flex size-14 items-center justify-center rounded-2xl bg-pop-lavender text-pop-primary-dark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
      <p class="mt-4 font-extrabold text-pop-primary">{{ text().received }}</p>
      @if (busy()) { <app-ui-alert variant="info" class="mt-4">{{ text().loading }}</app-ui-alert> }
      @if (preview(); as group) {
        <h2 class="mt-4 break-words text-3xl font-black text-pop-text">{{ group.groupName }}</h2>
        <p class="mt-2 text-sm text-pop-muted">{{ text().singleUse }}</p>
        <dl class="mt-5 divide-y divide-pop-border rounded-2xl border border-pop-border px-4 text-sm">
          <div class="flex justify-between gap-3 py-3"><dt>{{ text().currency }}</dt><dd class="text-right font-bold">{{ group.currency }}</dd></div>
          @if (user.email) { <div class="flex justify-between gap-3 py-3"><dt>{{ text().joinAs }}</dt><dd class="break-all text-right font-bold">{{ user.email }}</dd></div> }
          <div class="flex justify-between gap-3 py-3"><dt>{{ text().expires }}</dt><dd class="text-right font-bold">{{ formatDate(group.expiresAt) }}</dd></div>
        </dl>
        <div class="mt-5 flex flex-wrap gap-3">
          <app-ui-button variant="primary"  type="button" [disabled]="busy()" (click)="accept()">{{ text().join }}</app-ui-button>
          <app-ui-button variant="secondary"  type="button" (click)="declined.emit()">{{ text().decline }}</app-ui-button>
        </div>
      } @else if (!busy()) {
        <app-ui-alert variant="error" class="mt-4">{{ text()[errorKey()] }}</app-ui-alert>
        @if (!unusable()) { <app-ui-button variant="outline" class="mt-3" type="button" (click)="load()">{{ text().retry }}</app-ui-button> }
      }
      <app-ui-button variant="ghost" class="mt-5" type="button" (click)="changeAccount.emit()"><span class="underline">{{ text().changeAccount }}</span></app-ui-button>
      @if (message()) { <app-ui-alert [variant]="messageKey() === 'done' ? 'success' : 'info'" class="mt-3">{{ message() }}</app-ui-alert> }
    </section>
  `,
})
export class InviteAcceptanceCard implements OnChanges {
  @Input({ required: true }) user!: User;
  @Input({ required: true }) workerUrl = '';
  @Input({ required: true }) token = '';
  @Output() readonly joined = new EventEmitter<string>();
  @Output() readonly declined = new EventEmitter<void>();
  @Output() readonly changeAccount = new EventEmitter<void>();
  @Output() readonly invalidated = new EventEmitter<void>();
  readonly text = computed(() => qrInvitationText[language()]);
  readonly preview = signal<QrInvitePreview | null>(null);
  readonly errorKey = signal<'inviteFailed' | 'alreadyMember' | 'wrongAccount' | 'inviteExpired'>('inviteFailed');
  readonly unusable = signal(false);
  readonly busy = signal(false);
  private requestVersion = 0;
  private readonly messageKey = signal<'inviteFailed' | 'joining' | 'done' | null>(null);
  readonly message = computed(() => this.messageKey() ? this.text()[this.messageKey()!] : '');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['token'] || changes['user'] || changes['workerUrl']) {
      ++this.requestVersion;
      this.preview.set(null);
      if (this.token && this.workerUrl && this.user) void this.load();
      else { this.busy.set(false); this.messageKey.set(null); }
    }
  }
  formatDate(value: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  async load(): Promise<void> {
    const version = ++this.requestVersion;
    const token = this.token;
    const user = this.user;
    this.busy.set(true); this.messageKey.set(null); this.unusable.set(false);
    try { const preview = await new QrInvitationService(this.workerUrl).preview(user, token); if (version === this.requestVersion) this.preview.set(preview); }
    catch (error) { if (version === this.requestVersion) { this.preview.set(null); this.errorKey.set(this.keyFor(error)); this.clearUnusableToken(error); } }
    finally { if (version === this.requestVersion) this.busy.set(false); }
  }
  async accept(): Promise<void> {
    if (this.busy() || !this.preview()) return;
    const version = ++this.requestVersion;
    const token = this.token;
    const user = this.user;
    this.busy.set(true); this.messageKey.set('joining');
    try {
      const result = await new QrInvitationService(this.workerUrl).accept(user, token);
      if (version === this.requestVersion) { this.messageKey.set('done'); this.joined.emit(result.groupId); }
    } catch (error) { if (version === this.requestVersion) { this.messageKey.set(null); this.errorKey.set(this.keyFor(error)); this.preview.set(null); this.clearUnusableToken(error); } }
    finally { if (version === this.requestVersion) this.busy.set(false); }
  }

  private keyFor(error: unknown): 'inviteFailed' | 'alreadyMember' | 'wrongAccount' | 'inviteExpired' {
    if (!(error instanceof QrInviteRequestError)) return 'inviteFailed';
    if (error.code === 'already_member') return 'alreadyMember';
    if (error.code === 'email_mismatch') return 'wrongAccount';
    if (error.code === 'invitation_expired') return 'inviteExpired';
    return 'inviteFailed';
  }

  private clearUnusableToken(error: unknown): void {
    if (error instanceof QrInviteRequestError &&
        (error.code === 'invitation_expired' || (error.status === 403 && error.code === 'invitation_unavailable'))) {
      this.unusable.set(true);
      this.invalidated.emit();
    }
  }
}
