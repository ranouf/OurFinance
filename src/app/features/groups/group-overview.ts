import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { Component, Input, OnChanges, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { ActivityService, type ActivityEntry } from '../../core/firebase/activity-service';
import type { Group } from '../../core/firebase/group-model';
import { locale, t, type MessageKey } from '../../shared/utils/i18n';

const actions: Record<string, MessageKey> = {
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
  selector: 'app-group-overview',
  imports: [UiAlert, RouterLink],
  template: `
    <section class="mt-6 rounded-2xl border border-pop-border bg-white p-5 sm:p-6" [attr.aria-label]="t('recentActivity')">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-extrabold">{{ t('recentActivity') }}</h2>
        <a class="rounded-xl px-3 py-2 text-sm font-bold text-pop-primary-dark hover:bg-pop-lavender focus-visible:outline-2 focus-visible:outline-pop-primary" routerLink="/account">{{ t('showMore') }}</a>
      </div>
      <p class="mt-1 break-words text-sm font-semibold text-pop-muted">{{ group.name }} · {{ group.currency }}</p>
      @if (busy()) {
        <app-ui-alert variant="info" class="mt-4">{{ t('loadingActivity') }}</app-ui-alert>
      } @else if (error()) {
        <app-ui-alert variant="error" class="mt-4">{{ t('activityUnavailable') }}</app-ui-alert>
      } @else if (entries().length) {
        <ol class="mt-4 divide-y divide-pop-border">
          @for (entry of entries(); track entry.id) {
            <li class="flex items-start gap-3 py-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pop-peach text-pop-primary-dark" aria-hidden="true">✦</span>
              <span class="min-w-0">
                <strong class="block text-sm">{{ label(entry.action) }}</strong>
                <span class="block break-words text-xs text-pop-muted">{{ entry.actorId === user.uid ? t('me') : t('otherMember') }} · {{ date(entry) }}</span>
              </span>
            </li>
          }
        </ol>
      } @else {
        <p class="mt-4 text-sm text-pop-muted">{{ t('noActivity') }}</p>
      }
    </section>
  `,
})
export class GroupOverview implements OnChanges {
  @Input({ required: true }) group!: Group;
  @Input({ required: true }) user!: User;
  @Input({ required: true }) firebaseApp!: FirebaseApp;
  @Input() revision = 0;
  readonly t = t;
  readonly entries = signal<ActivityEntry[]>([]);
  readonly busy = signal(false);
  readonly error = signal(false);
  private requestId = 0;

  ngOnChanges(): void { void this.load(); }
  label(action: string): string { return t(actions[action] ?? 'activityRecorded'); }
  date(entry: ActivityEntry): string {
    return entry.at?.toDate ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(entry.at.toDate()) : '';
  }
  private async load(): Promise<void> {
    const requestId = ++this.requestId;
    this.busy.set(true); this.error.set(false); this.entries.set([]);
    try {
      const result = await new ActivityService(this.firebaseApp).history(this.group.id, undefined, 3);
      if (requestId === this.requestId) this.entries.set(result.entries);
    } catch {
      if (requestId === this.requestId) this.error.set(true);
    } finally {
      if (requestId === this.requestId) this.busy.set(false);
    }
  }
}
