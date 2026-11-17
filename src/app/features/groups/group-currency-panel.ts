import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { GroupService } from '../../core/firebase/group-service';
import type { Group } from '../../core/firebase/group-model';
import { currencyCatalog } from '../../shared/utils/currency';
import { locale, t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-group-currency-panel', imports: [FormsModule],
  template: `
    @if (editableGroups().length) {
      <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('changeGroupCurrency')">
        <h2 class="text-lg font-semibold">{{ t('changeGroupCurrency') }}</h2>
        <p class="mt-1 text-sm text-slate-600">{{ t('currencyBeforeFirst') }}</p>
        <form class="mt-4 space-y-3" (ngSubmit)="save()">
          <label class="block text-sm font-medium">{{ t('group') }}
            <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="currencyGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="selectGroup()" required>
              <option value="">{{ t('chooseGroup') }}</option>
              @for (group of editableGroups(); track group.id) { <option [value]="group.id">{{ group.name }} · {{ group.currency }}</option> }
            </select>
          </label>
          @if (selectedGroupId) {
            <label class="block text-sm font-medium">{{ t('groupCurrency') }}
              <select class="mt-1 w-full rounded-lg border border-slate-300 p-3" name="newGroupCurrency" [(ngModel)]="currencyCode" required>
                @for (currency of currencies(); track currency.code) { <option [value]="currency.code">{{ currency.code }} · {{ currency.name }} ({{ currency.symbol }}, {{ currency.minorDigits }})</option> }
              </select>
            </label>
            <button class="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="submit" [disabled]="busy() || currencyCode === selectedGroup()?.currency">{{ t('saveGroupCurrency') }}</button>
          }
        </form>
        @if (message()) { <p class="mt-3 text-sm" role="status">{{ message() }}</p> }
      </section>
    }
  `,
})
export class GroupCurrencyPanel {
  @Input({ required: true }) groups: readonly Group[] = [];
  @Input({ required: true }) user?: User;
  @Input({ required: true }) firebaseApp?: FirebaseApp;
  @Input({ required: true }) workerUrl?: string;
  @Output() changed = new EventEmitter<void>();
  readonly t = t;
  readonly currencies = computed(() => currencyCatalog(locale()));
  readonly busy = signal(false);
  readonly message = signal('');
  selectedGroupId = '';
  currencyCode = '';
  editableGroups(): Group[] { return this.groups.filter(group => group.status === 'active' && !group.currencyLocked && group.ownerId === this.user?.uid); }
  selectedGroup(): Group | undefined { return this.editableGroups().find(group => group.id === this.selectedGroupId); }
  selectGroup(): void { this.currencyCode = this.selectedGroup()?.currency ?? ''; this.message.set(''); }
  async save(): Promise<void> {
    const group = this.selectedGroup();
    if (!this.user || !this.firebaseApp || !this.workerUrl || !group || this.busy() || this.currencyCode === group.currency) return;
    this.busy.set(true); this.message.set('');
    try {
      await new GroupService(this.firebaseApp, this.workerUrl).changeCurrency(this.user, group.id, this.currencyCode);
      this.message.set(t('currencyChanged'));
      this.changed.emit();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      this.message.set(t(code === 'currency_locked' ? 'currencyLocked' : code === 'currency_disabled' ? 'currencyDisabled' : 'currencyChangeFailed'));
    } finally { this.busy.set(false); }
  }
}
