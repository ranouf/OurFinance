import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';
import { categoryById, categoryColorClass } from '../../shared/utils/categories';
import { GroupOverview } from '../../features/groups/group-overview';

@Component({
  imports: [FormsModule, RouterLink, GroupOverview],
  templateUrl: './dashboard.component.html',
})
export class DashboardPage {
  readonly app = inject(App);
  private readonly router = inject(Router);
  readonly t = t;
  search = '';
  memberBalanceLabel(value: bigint): string { return value > 0n ? t('receivable') : value < 0n ? t('payable') : t('balanced'); }
  searchExpenses(): void {
    const search = this.search.trim();
    if (search) void this.router.navigate(['/expenses'], { queryParams: { search } });
  }
  readonly categoryColorClass = categoryColorClass;
  categoryIcon(id: string): string { return categoryById(id).icon; }
  categoryPercent(amount: bigint): number {
    const total = this.app.dashboardCategories().reduce((sum, row) => sum + row.amountMinor, 0n);
    return total > 0n ? Number((amount * 100n + total / 2n) / total) : 0;
  }
  otherCategoryAmount(): bigint { return this.app.dashboardCategories().slice(4).reduce((sum, row) => sum + row.amountMinor, 0n); }
  hasOtherCategories(): boolean { return this.otherCategoryAmount() > 0n; }
}
