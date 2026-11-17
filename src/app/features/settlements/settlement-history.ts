import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Group } from '../../core/firebase/group-model';
import { SettlementService, type SettlementHistoryEntry } from '../../core/firebase/settlement-service';
import { formatMinor } from '../../shared/utils/currency';
import { locale, t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-settlement-history',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-3xl border border-pop-border bg-pop-surface p-5 text-pop-text shadow-sm md:p-7" [attr.aria-label]="t('settlementHistory')">
      <div class="mb-5 h-1.5 w-14 rounded-full bg-pop-sun" aria-hidden="true"></div>
      <h2 class="text-2xl font-extrabold tracking-tight">{{ t('settlementHistory') }}</h2>
      <label class="mt-5 block text-sm font-bold">{{ t('group') }}
        <select class="mt-2 min-h-11 w-full rounded-xl border border-pop-border bg-pop-surface p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="settlementHistoryGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">{{ t('chooseGroup') }}</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <button class="mt-3 min-h-11 rounded-xl bg-pop-primary px-5 py-2 text-sm font-bold text-white hover:bg-pop-primary-dark disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">{{ t('refresh') }}</button>
        @if (entries().length) {
          <ul class="mt-5 space-y-3">
            @for (entry of entries(); track entry.id) {
              <li class="rounded-2xl border border-pop-border bg-pop-surface p-4 text-sm shadow-sm">
                <div class="flex items-center justify-between gap-3"><span class="min-w-0 break-all font-bold">{{ memberLabel(entry.fromUserId) }} → {{ memberLabel(entry.toUserId) }}</span><span class="shrink-0 font-extrabold text-pop-primary-dark">{{ amount(entry) }}</span></div>
                <p class="mt-1 text-pop-muted">{{ displayDate(entry.date) }}</p>
              </li>
            }
          </ul>
          @if (hasMore()) { <button class="mt-3 min-h-11 rounded-xl border border-pop-border px-4 py-2 text-sm font-bold text-pop-primary-dark disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">{{ t('showMore') }}</button> }
        } @else if (!busy() && !message()) { <p class="mt-5 rounded-2xl bg-pop-lavender p-5 text-sm text-pop-muted">{{ t('noSettlement') }}</p> }
      }
      @if (message()) { <p class="mt-4 text-sm text-rose-700" role="status">{{ message() }}</p> }
    </section>
  `,
})
export class SettlementHistory implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input({ required: true }) workerUrl?: string;
  @Input() revision = 0;
  readonly entries = signal<SettlementHistoryEntry[]>([]);
  readonly t = t;
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: SettlementService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp && this.workerUrl) this.service = new SettlementService(this.firebaseApp, this.workerUrl);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  amount(entry: SettlementHistoryEntry): string { return formatMinor(entry.amountMinor, entry.currency, locale()); }
  displayDate(value: string): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
  memberLabel(userId: string): string { return userId === this.user?.uid ? t('me') : `${t('otherMember')} ${userId.slice(0, 8)}`; }
  async refresh(): Promise<void> { this.entries.set([]); this.last = undefined; this.hasMore.set(false); await this.load(); }
  async loadMore(): Promise<void> { await this.load(); }
  private async load(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.message.set('');
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const page = await this.service.history(groupId, this.last);
      if (requestId !== this.requestId) return;
      this.entries.update(entries => [...entries, ...page.entries]);
      this.last = page.last;
      this.hasMore.set(page.hasMore);
    } catch { if (requestId === this.requestId) this.message.set(t('historyUnavailable')); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
