import { Component } from '@angular/core';
import { AuthenticatedLayoutComponent } from '../../layouts/authenticated-layout.component';
import { StatisticsBannerComponent } from './banner.component';
import { StatisticsControlsComponent } from './controls.component';
import { StatisticsMetricsComponent } from './metrics.component';
import { StatisticsSpendingByCategoryComponent } from './spendingByCategory.component';
import { StatisticsPaidVsAssignedComponent } from './paidVsAssigned.component';
import { StatisticsSpendingOverTimeComponent } from './spendingOverTime.component';
import { StatisticsWhoOwesWhomComponent } from './whoOwesWhom.component';
import { StatisticsRepaymentHistoryComponent } from './repaymentHistory.component';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, StatisticsBannerComponent, StatisticsControlsComponent, StatisticsMetricsComponent, StatisticsSpendingByCategoryComponent, StatisticsPaidVsAssignedComponent, StatisticsSpendingOverTimeComponent, StatisticsWhoOwesWhomComponent, StatisticsRepaymentHistoryComponent],
  template: `<app-authenticated-layout route="statistics" title="Statistics" subtitle="Spending insights and balances for your group.">
    <app-statistics-banner banner />
    <div content><app-statistics-controls /><app-statistics-metrics /><div class="stats-grid"><app-statistics-spending-by-category /><app-statistics-paid-vs-assigned /><app-statistics-spending-over-time /><app-statistics-who-owes-whom /><app-statistics-repayment-history /></div></div>
  </app-authenticated-layout>`
})
export class StatisticsPageComponent {}
