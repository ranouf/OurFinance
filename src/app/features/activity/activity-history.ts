import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { ActivityService, type ActivityEntry } from '../../core/firebase/activity-service';
import type { Group } from '../../core/firebase/group-model';
import { locale, t, type MessageKey } from '../../shared/utils/i18n';

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
  imports: [FieldComponent, DropdownComponent, UiAlert, UiButton, FormsModule],
  template: `
    <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('groupActivity')">
      <h2 class="text-lg font-semibold">{{ t('groupActivity') }}</h2>
      <app-field class="mt-4" controlId="activityGroup" [label]="t('group')"><app-dropdown controlId="activityGroup" [options]="groupDropdownOptions(groups, t('chooseGroup'), false)" name="activityGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="refresh()" /></app-field>
      @if (selectedGroupId) {
        <app-ui-button variant="outline" class="mt-3" type="button" [disabled]="busy()" (click)="refresh()">{{ t('refresh') }}</app-ui-button>
        @if (entries().length) {
          <ol class="mt-4 divide-y divide-slate-200">
            @for (entry of entries(); track entry.id) {
              <li class="py-3 text-sm">
                <p class="font-medium">{{ label(entry.action) }}</p>
                <p class="mt-1 text-slate-600">{{ entry.actorId === user?.uid ? t('me') : t('otherMember') }} · {{ date(entry) }}</p>
              </li>
            }
          </ol>
        } @else if (!busy() && !message()) { <p class="mt-4 text-sm text-slate-600">{{ t('noActivity') }}</p> }
        @if (hasMore()) { <app-ui-button variant="secondary" class="mt-3" type="button" [disabled]="busy()" (click)="loadMore()">{{ t('showMore') }}</app-ui-button> }
      }
      @if (message()) { <app-ui-alert variant="error" class="mt-4">{{ message() }}</app-ui-alert> }
    </section>
  `,
})
export class ActivityHistory implements OnChanges {
  readonly groupDropdownOptions = groupDropdownOptions;
  @Input({ required: true }) groups: Group[] = [];
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) user?: User;
  @Input() revision = 0;
  readonly entries = signal<ActivityEntry[]>([]);
  readonly t = t;
  readonly hasMore = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  private service?: ActivityService;
  private last?: QueryDocumentSnapshot<DocumentData>;
  private requestId = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.firebaseApp) this.service = new ActivityService(this.firebaseApp);
    if (changes['revision'] && !changes['revision'].firstChange && this.selectedGroupId) void this.refresh();
  }
  label(action: string): string { return t(labels[action] ?? 'activityRecorded'); }
  date(entry: ActivityEntry): string { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(entry.at.toDate()); }
  async refresh(): Promise<void> {
    this.entries.set([]);
    this.last = undefined;
    this.hasMore.set(false);
    await this.load();
  }
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
    } catch { if (requestId === this.requestId) this.message.set('Activité indisponible.'); }
    finally { if (requestId === this.requestId) this.busy.set(false); }
  }
}
