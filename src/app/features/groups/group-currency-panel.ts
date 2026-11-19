import { FieldComponent } from '../../shared/components/field/field.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { currencyDropdownOptions, groupDropdownOptions } from '../../shared/components/dropdown/dropdown-options';
import { UiAlert } from '../../shared/components/ui-alert/ui-alert';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { GroupService } from '../../core/firebase/group-service';
import type { Group } from '../../core/firebase/group-model';
import { currencyCatalog } from '../../shared/utils/currency';
import { locale, t } from '../../shared/utils/i18n';

@Component({
  selector: 'app-group-currency-panel', imports: [FieldComponent, DropdownComponent, UiAlert, UiButton, FormsModule],
  template: `
    @if (editableGroups().length) {
      <section class="mt-6 rounded-2xl border border-slate-200 bg-white p-5" [attr.aria-label]="t('changeGroupCurrency')">
        <h2 class="text-lg font-semibold">{{ t('changeGroupCurrency') }}</h2>
        <p class="mt-1 text-sm text-slate-600">{{ t('currencyBeforeFirst') }}</p>
        <form class="mt-4 space-y-3" (ngSubmit)="save()">
          <app-field class="block" controlId="currencyGroup" [label]="t('group')"><app-dropdown controlId="currencyGroup" [options]="groupDropdownOptions(editableGroups(), t('chooseGroup'), true)" name="currencyGroup" [(ngModel)]="selectedGroupId" (ngModelChange)="selectGroup()" required /></app-field>
          @if (selectedGroupId) {
            <app-field class="block" controlId="new-group-currency" [label]="t('groupCurrency')" [required]="true">
              <app-dropdown controlId="new-group-currency" name="newGroupCurrency" [options]="currencyDropdownOptions(currencies(), true)" [searchable]="true" [searchLabel]="t('search')" [(ngModel)]="currencyCode" required />
            </app-field>
            <app-ui-button variant="primary"  type="submit" [disabled]="busy() || currencyCode === selectedGroup()?.currency">{{ t('saveGroupCurrency') }}</app-ui-button>
          }
        </form>
        @if (message()) { <app-ui-alert variant="info" class="mt-3">{{ message() }}</app-ui-alert> }
      </section>
    }
  `,
})
export class GroupCurrencyPanel {
  readonly groupDropdownOptions = groupDropdownOptions;
  readonly currencyDropdownOptions = currencyDropdownOptions;
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
