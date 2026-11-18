import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { ActivityService, type ActivityEntry } from '../../core/firebase/activity-service';
import type { Group } from '../../core/firebase/group-model';
import { loadSharedMemberProfiles } from '../../core/firebase/member-profile-service';
import { locale, t, type MessageKey } from '../../shared/utils/i18n';
import { activityGroupForChange } from './activity-group';

const labels: Record<string, MessageKey> = {
  expense_created: 'expenseCreated',
  expense_updated: 'expenseUpdated',
  expense_deleted: 'expenseDeleted',
  settlement_recorded: 'settlementRecorded',
  import_created: 'importCreated',
  import_undone: 'importUndone',
  category_created: 'categoryCreated',
  category_updated: 'categoryUpdated',
  category_archived: 'categoryArchived',
  category_reactivated: 'categoryReactivated',
  comment_created: 'commentCreated',
};

@Component({
  selector: 'app-activity-history',
  imports: [FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('groupActivity')">
      <h2 class="text-lg font-semibold">{{ t('groupActivity') }}</h2>
      <label class="mt-4 block text-sm font-medium">{{ t('group') }}
        <select class="mt-1 min-h-11 w-full rounded-lg border border-pop-border bg-white p-3 focus-visible:outline-2 focus-visible:outline-pop-primary" name="activityGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()">
          <option value="">{{ t('chooseGroup') }}</option>
          @for (group of groups; track group.id) { <option [value]="group.id">{{ group.name }}</option> }
        </select>
      </label>
      @if (selectedGroupId) {
        <button class="mt-3 min-h-11 rounded-lg border border-pop-primary px-3 py-2 text-sm font-bold text-pop-primary-dark focus-visible:outline-2 focus-visible:outline-pop-primary disabled:opacity-50" type="button" [disabled]="busy()" (click)="refresh()">{{ t('refresh') }}</button>
        @if (busy()) { <p class="mt-4 text-sm text-pop-muted" role="status">{{ t('loadingActivity') }}</p> }
        @if (entries().length) {
          <ol class="mt-4 divide-y divide-slate-200">
            @for (entry of entries(); track entry.id) {
              <li class="py-3 text-sm">
                <p class="font-medium">{{ label(entry.action) }}</p>
                <p class="mt-1 text-slate-600">{{ actorLabel(entry.actorId) }} · {{ date(entry) }}</p>
              </li>
            }
          </ol>
        } @else if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">{{ t('noActivity') }}</p> }
        @if (hasMore()) { <button class="mt-3 min-h-11 rounded-lg border border-pop-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-pop-primary disabled:opacity-50" type="button" [disabled]="busy()" (click)="loadMore()">{{ t('showMore') }}</button> }
      }
      @if (message(); as key) { <p class="mt-4 text-sm text-rose-700" role="alert">{{ t(key) }}</p> }
    </section>
  `,
})
export class ActivityHistory implements OnChanges {
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() workerUrl?: string;
  @Input() preferredGroupId = '';
  @Input() revision = 0;
  readonly entries = signal<ActivityEntry[]>([]);
  readonly memberNames = signal<Record<string, string>>({});
  readonly t = t;
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal<MessageKey | null>(null);
  selectedGroupId = '';
  private service?: ActivityService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new ActivityService(this.firebaseApp);
    if (changes['groups'] || changes['preferredGroupId']) {
      const next = activityGroupForChange(this.selectedGroupId, this.preferredGroupId, this.groups.map(group => group.id),
        !!changes['preferredGroupId'] && changes['preferredGroupId'].previousValue !== changes['preferredGroupId'].currentValue);
      if (next !== this.selectedGroupId) { this.selectedGroupId = next; void this.refresh(); }
    }
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  label(action: string): string { return t(labels[action] ?? 'activityRecorded'); }
  actorLabel(userId: string): string { return userId === this.user?.uid ? t('me') : this.memberNames()[userId] || t('otherMember'); }
  date(entry: ActivityEntry): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(entry.at.toDate()); }
  async refresh(): Promise<void> {
    this.entries.set([]);
    this.memberNames.set({});
    this.last = undefined;
    this.hasMore.set(false);
    await this.load();
  }
  async loadMore(): Promise<void> { await this.load(); }
  private async load(): Promise<void> {
    const groupId = this.selectedGroupId;
    const requestId = ++this.requestId;
    this.message.set(null);
    if (!groupId || !this.service) { this.busy.set(false); return; }
    this.busy.set(true);
    try {
      const [page, names] = await Promise.all([
        this.service.history(groupId, this.last),
        this.workerUrl && this.user ? loadSharedMemberProfiles(this.workerUrl, groupId, this.user).catch(() => []) : [],
      ]);
      if (requestId !== this.requestId) return;
      this.memberNames.set(Object.fromEntries(names.filter(item => item.displayName).map(item => [item.userId, item.displayName!])));
      this.entries.update(entries => [...entries, ...page.entries]);
      this.last = page.last;
      this.hasMore.set(page.hasMore);
    } catch { if (requestId === this.requestId) this.message.set('activityUnavailable'); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
