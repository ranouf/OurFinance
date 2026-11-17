import { Component, Input, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { User } from 'firebase/auth';
import type { Group } from '../../core/firebase/group-model';
import { QrInvitationService, type QrInviteCreated, type QrInviteEntry } from '../../core/firebase/qr-invitation-service';
import { InviteQrCode } from '../../shared/components/invite-qr-code/invite-qr-code';
import { language, locale } from '../../shared/utils/i18n';
import { qrInvitationText } from './qr-invitation-text';

@Component({
  selector: 'app-qr-invitation-panel',
  imports: [FormsModule, InviteQrCode],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-white p-5 shadow-sm sm:p-7" [attr.aria-label]="text().heading">
      <h2 class="text-xl font-extrabold text-pop-text">{{ text().heading }}</h2>
      <p class="mt-2 text-sm text-pop-muted">{{ text().intro }}</p>
      @if (ownedGroups().length) {
        <form class="mt-5 grid gap-3 sm:grid-cols-2" (ngSubmit)="create()">
          <label class="text-sm font-bold text-pop-text">{{ text().group }}
            <select class="mt-1 min-h-11 w-full rounded-xl border border-pop-border bg-white p-3" name="qrGroup" [(ngModel)]="selectedGroupId" required (ngModelChange)="onGroupChanged()">
              <option value="">{{ text().choose }}</option>
              @for (group of ownedGroups(); track group.id) { <option [value]="group.id">{{ group.name }} · {{ group.currency }}</option> }
            </select>
          </label>
          <label class="text-sm font-bold text-pop-text">{{ text().target }}
            <input class="mt-1 min-h-11 w-full rounded-xl border border-pop-border p-3" type="email" name="qrTarget" [(ngModel)]="targetEmail" autocomplete="off" />
          </label>
          @if (!targetEmail.trim()) { <p class="text-sm text-pop-muted sm:col-span-2">{{ text().openWarning }}</p> }
          <button class="min-h-11 rounded-xl bg-pop-primary px-4 py-2 font-extrabold text-white disabled:opacity-50 sm:w-fit" type="submit" [disabled]="busy() || !selectedGroupId">{{ text().create }}</button>
        </form>
        @if (created(); as invite) {
          <div class="mt-5 rounded-2xl bg-pop-lavender p-4 text-pop-text" role="status">
            <p class="text-sm font-bold">{{ text().created }}</p>
            <p class="mt-1 text-sm">{{ text().expires }} : {{ formatDate(invite.expiresAt) }}</p>
            <app-invite-qr-code class="mt-4 block" [link]="invite.link" [label]="text().qrLabel" [copyLabel]="text().copy" [shareLabel]="text().share" [copiedLabel]="text().copied" [failedLabel]="text().copyFailed" />
            <button class="mt-3 min-h-11 rounded-xl border border-pop-primary px-4 py-2 font-bold text-pop-primary-dark" type="button" (click)="created.set(null)">{{ text().close }}</button>
          </div>
        }
        @if (selectedGroupId) {
          <div class="mt-6 border-t border-pop-border pt-4">
            <h3 class="font-extrabold">{{ text().current }}</h3>
            @if (loading()) { <p class="mt-2 text-sm" role="status">{{ text().loading }}</p> }
            @if (listError()) { <p class="mt-2 text-sm" role="alert">{{ text().failed }}</p> }
            <ul class="mt-3 space-y-2">
              @for (entry of entries(); track entry.invitationId) {
                <li class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-pop-background p-3 text-sm">
                  <span class="min-w-0 break-words">{{ status(entry.status) }} · {{ formatDate(entry.expiresAt) }} @if (entry.targetEmail) { · {{ entry.targetEmail }} }</span>
                  @if (entry.status === 'active') { <button class="min-h-11 rounded-xl border border-pop-primary px-3 py-2 font-bold text-pop-primary-dark disabled:opacity-50" type="button" [disabled]="busy()" (click)="revoke(entry.invitationId)">{{ text().revoke }}</button> }
                </li>
              }
            </ul>
            @if (nextPageToken()) { <button class="mt-3 min-h-11 rounded-xl border border-pop-border px-3 py-2 font-bold" type="button" [disabled]="loading()" (click)="loadMore()">{{ text().more }}</button> }
          </div>
        }
      }
      @if (message()) { <p class="mt-3 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class QrInvitationPanel {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl = '';
  readonly text = computed(() => qrInvitationText[language()]);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly listError = signal(false);
  readonly created = signal<QrInviteCreated | null>(null);
  readonly entries = signal<QrInviteEntry[]>([]);
  readonly nextPageToken = signal<string | null>(null);
  private readonly messageKey = signal<keyof typeof qrInvitationText.fr | null>(null);
  readonly message = computed(() => this.messageKey() ? this.text()[this.messageKey()!] : '');
  selectedGroupId = '';
  targetEmail = '';

  private service(): QrInvitationService { return new QrInvitationService(this.workerUrl); }
  ownedGroups(): Group[] { return this.groups.filter(group => group.ownerId === this.user?.uid && group.status === 'active'); }
  formatDate(value: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  status(value: string): string { return value === 'active' ? this.text().pending : this.text()[value as 'accepted' | 'revoked' | 'expired'] ?? value; }
  onGroupChanged(): void { this.created.set(null); this.entries.set([]); this.nextPageToken.set(null); void this.loadMore(); }

  async create(): Promise<void> {
    if (!this.user || !this.selectedGroupId || this.busy()) return;
    this.busy.set(true); this.messageKey.set(null); this.created.set(null);
    try {
      this.created.set(await this.service().create(this.user, this.selectedGroupId, this.targetEmail.trim() || undefined));
      this.messageKey.set('created');
      await this.loadMore(true);
    } catch { this.messageKey.set('failed'); }
    finally { this.busy.set(false); }
  }

  async loadMore(reset = false): Promise<void> {
    if (!this.user || !this.selectedGroupId || this.loading()) return;
    if (reset) { this.entries.set([]); this.nextPageToken.set(null); }
    this.loading.set(true); this.listError.set(false);
    try {
      const result = await this.service().list(this.user, this.selectedGroupId, this.nextPageToken() ?? undefined);
      this.entries.update(current => [...current, ...result.invitations]);
      this.nextPageToken.set(result.nextPageToken);
    } catch { this.listError.set(true); }
    finally { this.loading.set(false); }
  }

  async revoke(invitationId: string): Promise<void> {
    if (!this.user || this.busy()) return;
    this.busy.set(true); this.messageKey.set(null);
    try {
      await this.service().revoke(this.user, this.selectedGroupId, invitationId);
      this.entries.update(entries => entries.map(entry => entry.invitationId === invitationId ? { ...entry, status: 'revoked' } : entry));
      if (this.created()?.invitationId === invitationId) this.created.set(null);
      this.messageKey.set('revokedDone');
    } catch { this.messageKey.set('failed'); }
    finally { this.busy.set(false); }
  }
}
