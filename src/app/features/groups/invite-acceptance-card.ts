import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { QrInvitationService, QrInviteRequestError, type QrInvitePreview } from '../../core/firebase/qr-invitation-service';
import { language, locale } from '../../shared/utils/i18n';
import { qrInvitationText } from './qr-invitation-text';

@Component({
  selector: 'app-invite-acceptance-card',
  template: `
    <section class="mx-auto mt-6 max-w-xl rounded-3xl border border-pop-border bg-white p-6 shadow-sm" [attr.aria-label]="text().received">
      <p class="font-extrabold text-pop-primary">{{ text().received }}</p>
      @if (busy()) { <p class="mt-4" role="status">{{ text().loading }}</p> }
      @if (preview(); as group) {
        <h2 class="mt-4 break-words text-2xl font-extrabold text-pop-text">{{ group.groupName }}</h2>
        <p class="mt-1 font-bold text-pop-muted">{{ group.currency }}</p>
        <p class="mt-2 text-sm">{{ text().expires }} : {{ formatDate(group.expiresAt) }}</p>
        <div class="mt-5 flex flex-wrap gap-3">
          <button class="min-h-11 rounded-xl bg-pop-primary px-4 py-2 font-extrabold text-white disabled:opacity-50" type="button" [disabled]="busy()" (click)="accept()">{{ text().join }}</button>
          <button class="min-h-11 rounded-xl border border-pop-border px-4 py-2 font-bold" type="button" (click)="declined.emit()">{{ text().decline }}</button>
        </div>
      } @else if (!busy()) {
        <p class="mt-4 text-sm" role="alert">{{ text()[errorKey()] }}</p>
        @if (!unusable()) { <button class="mt-3 min-h-11 rounded-xl border border-pop-primary px-4 py-2 font-bold text-pop-primary-dark" type="button" (click)="load()">{{ text().retry }}</button> }
      }
      <button class="mt-5 block min-h-11 text-sm font-bold text-pop-primary-dark underline" type="button" (click)="changeAccount.emit()">{{ text().changeAccount }}</button>
      @if (message()) { <p class="mt-3 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class InviteAcceptanceCard implements OnInit {
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
  private readonly messageKey = signal<'inviteFailed' | 'joining' | 'done' | null>(null);
  readonly message = computed(() => this.messageKey() ? this.text()[this.messageKey()!] : '');

  ngOnInit(): void { void this.load(); }
  formatDate(value: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  async load(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.messageKey.set(null); this.unusable.set(false);
    try { this.preview.set(await new QrInvitationService(this.workerUrl).preview(this.user, this.token)); }
    catch (error) { this.preview.set(null); this.errorKey.set(this.keyFor(error)); this.clearUnusableToken(error); }
    finally { this.busy.set(false); }
  }
  async accept(): Promise<void> {
    if (this.busy() || !this.preview()) return;
    this.busy.set(true); this.messageKey.set('joining');
    try {
      const result = await new QrInvitationService(this.workerUrl).accept(this.user, this.token);
      this.messageKey.set('done'); this.joined.emit(result.groupId);
    } catch (error) { this.messageKey.set(null); this.errorKey.set(this.keyFor(error)); this.preview.set(null); this.clearUnusableToken(error); }
    finally { this.busy.set(false); }
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
