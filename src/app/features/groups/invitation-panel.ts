import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { User } from 'firebase/auth';
import { InvitationService, invitationCodeFromHash, invitationLink } from '../../core/firebase/invitation-service';
import type { Group } from '../../core/firebase/group-model';
import { language } from '../../shared/utils/i18n';
import { invitationText } from './invitation-text';

@Component({
  selector: 'app-invitation-panel',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-pop-border bg-white p-5" [attr.aria-label]="text().heading">
      <h2 class="text-lg font-extrabold text-pop-text">{{ text().heading }}</h2>
      <p class="mt-1 text-sm text-pop-muted">{{ text().intro }}</p>
      @if (ownedGroups().length) {
        <form class="mt-4 space-y-3" (ngSubmit)="create()">
          <label class="block text-sm font-medium">{{ text().group }}
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="invitationGroup" [(ngModel)]="selectedGroupId" required>
              <option value="">{{ text().chooseGroup }}</option>
              @for (group of ownedGroups(); track group.id) { <option [value]="group.id">{{ group.name }}</option> }
            </select>
          </label>
          <label class="block text-sm font-medium">{{ text().recipient }}
            <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" type="email" name="targetEmail" [(ngModel)]="targetEmail" autocomplete="off" required />
          </label>
          <button class="min-h-11 rounded-xl bg-pop-coral px-4 py-2 font-bold text-pop-text disabled:opacity-50" type="submit" [disabled]="busy()">{{ text().create }}</button>
        </form>
        @if (hasCode()) {
          <div class="mt-3 rounded-xl bg-pop-mint-soft p-3 text-sm text-pop-text">
            <p>{{ text().ready }}</p>
            <button class="mt-2 min-h-11 rounded-xl border border-pop-primary px-3 py-2 font-bold" type="button" (click)="copy()">{{ text().copy }}</button>
          </div>
        }
      }
      <form class="mt-5 space-y-3 border-t border-pop-border pt-4" (ngSubmit)="accept()">
        <h3 class="font-bold">{{ text().join }}</h3>
        <label class="block text-sm font-medium">{{ text().code }}
          <input class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="receivedCode" [(ngModel)]="receivedCode" autocomplete="off" required />
        </label>
        <button class="min-h-11 rounded-xl border border-pop-primary px-4 py-2 font-bold text-pop-primary-dark disabled:opacity-50" type="submit" [disabled]="busy()">{{ text().accept }}</button>
      </form>
      @if (message()) { <p class="mt-3 text-sm" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class InvitationPanel implements OnInit {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl = '';
  @Output() readonly joined = new EventEmitter<void>();
  readonly busy = signal(false);
  readonly hasCode = signal(false);
  readonly text = computed(() => invitationText[language()]);
  private readonly messageKey = signal<keyof typeof invitationText.fr | null>(null);
  readonly message = computed(() => this.messageKey() ? this.text()[this.messageKey()!] : '');
  selectedGroupId = '';
  targetEmail = '';
  receivedCode = '';
  private code = '';

  ngOnInit(): void {
    const code = invitationCodeFromHash(window.location.hash);
    if (!code) return;
    this.receivedCode = code;
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
    this.messageKey.set('received');
  }

  ownedGroups(): Group[] { return this.groups.filter(group => group.ownerId === this.user?.uid && group.status === 'active'); }

  async create(): Promise<void> {
    if (!this.user || !this.selectedGroupId || !this.targetEmail.trim() || this.busy()) return;
    this.busy.set(true); this.messageKey.set(null); this.code = ''; this.hasCode.set(false);
    try {
      this.code = await new InvitationService(this.workerUrl).create(this.user, this.selectedGroupId, this.targetEmail);
      this.hasCode.set(true); this.messageKey.set('created');
    } catch { this.messageKey.set('createFailed'); }
    finally { this.busy.set(false); }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(invitationLink(window.location.origin, window.location.pathname, this.code));
      this.messageKey.set('copied');
    } catch { this.messageKey.set('copyFailed'); }
  }

  async accept(): Promise<void> {
    if (!this.user || !this.receivedCode.trim() || this.busy()) return;
    const code = this.receivedCode;
    this.receivedCode = '';
    this.busy.set(true); this.messageKey.set(null);
    try {
      await new InvitationService(this.workerUrl).accept(this.user, code);
      this.joined.emit(); this.messageKey.set('accepted');
    } catch { this.messageKey.set('acceptFailed'); }
    finally { this.busy.set(false); }
  }
}
