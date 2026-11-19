import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiControlDirective } from '../../shared/components/ui-field/ui-control.directive';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
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
  imports: [FieldComponent, DropdownComponent, UiControlDirective, UiAlert, UiButton, FormsModule, InviteQrCode],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-white p-5 shadow-sm sm:p-7" [attr.aria-label]="text().heading">
      <h2 class="text-xl font-extrabold text-pop-text">{{ text().heading }}</h2>
      <p class="mt-2 text-sm text-pop-muted">{{ text().intro }}</p>
      @if (ownedGroups().length) {
        <form class="mt-5 grid gap-3 sm:grid-cols-2" (ngSubmit)="create()">
          <app-field class="block" controlId="qrGroup" [label]="text().group"><app-dropdown controlId="qrGroup" [options]="groupDropdownOptions(ownedGroups(), text().choose, true)" name="qrGroup" [(ngModel)]="selectedGroupId" required (ngModelChange)="onGroupChanged()" /></app-field>
          <label class="text-sm font-bold text-pop-text">{{ text().target }}
            <input appUiControl class="mt-1 w-full" type="email" name="qrTarget" [(ngModel)]="targetEmail" autocomplete="off" />
          </label>
          @if (!targetEmail.trim()) { <p class="text-sm text-pop-muted sm:col-span-2">{{ text().openWarning }}</p> }
          <app-ui-button variant="primary" class="sm:w-fit" type="submit" [disabled]="busy() || !selectedGroupId">{{ text().create }}</app-ui-button>
        </form>
        @if (created(); as invite) {
          <div class="mt-5 rounded-2xl bg-pop-lavender p-4 text-pop-text" role="status">
            <p class="text-sm font-bold">{{ text().created }}</p>
            <p class="mt-1 text-sm">{{ text().expires }} : {{ formatDate(invite.expiresAt) }}</p>
            <app-invite-qr-code class="mt-4 block" [link]="invite.link" [label]="text().qrLabel" [copyLabel]="text().copy" [shareLabel]="text().share" [copiedLabel]="text().copied" [failedLabel]="text().copyFailed" />
            <app-ui-button variant="outline" class="mt-3" type="button" (click)="created.set(null)">{{ text().close }}</app-ui-button>
          </div>
        }
        @if (selectedGroupId) {
          <div class="mt-6 border-t border-pop-border pt-4">
            <h3 class="font-extrabold">{{ text().current }}</h3>
            @if (loading()) { <app-ui-alert variant="info" class="mt-2">{{ text().loading }}</app-ui-alert> }
            @if (listError()) { <app-ui-alert variant="error" class="mt-2">{{ text().failed }}</app-ui-alert> }
            <ul class="mt-3 space-y-2">
              @for (entry of entries(); track entry.invitationId) {
                <li class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-pop-background p-3 text-sm">
                  <span class="min-w-0 break-words">{{ status(entry.status) }} · {{ formatDate(entry.expiresAt) }} @if (entry.targetEmail) { · {{ entry.targetEmail }} }</span>
                  @if (entry.status === 'active') { <app-ui-button variant="outline"  type="button" [disabled]="busy()" (click)="revoke(entry.invitationId)">{{ text().revoke }}</app-ui-button> }
                </li>
              }
            </ul>
            @if (nextPageToken()) { <app-ui-button variant="secondary" class="mt-3" type="button" [disabled]="loading()" (click)="loadMore()">{{ text().more }}</app-ui-button> }
          </div>
        }
      }
      @if (message()) { <app-ui-alert variant="info" class="mt-3">{{ message() }}</app-ui-alert> }
    </section>
  `,
})
export class QrInvitationPanel {
  readonly groupDropdownOptions = groupDropdownOptions;
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
