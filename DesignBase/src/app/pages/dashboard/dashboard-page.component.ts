import { Component } from '@angular/core';
import { AuthenticatedLayoutComponent } from '../../layouts/authenticated-layout.component';
import { DashboardBannerComponent } from './banner.component';
import { DashboardActionsComponent } from './actions.component';
import { DashboardGroupsComponent } from './groups.component';
import { DashboardRecentExpensesComponent } from './recentExpenses.component';
import { DashboardWhoOwesWhomComponent } from './whoOwesWhom.component';
import { DashboardExpensesByCategoryComponent } from './expensesByCategory.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, DashboardBannerComponent, DashboardActionsComponent, DashboardGroupsComponent, DashboardRecentExpensesComponent, DashboardWhoOwesWhomComponent, DashboardExpensesByCategoryComponent],
  template: `<app-authenticated-layout route="dashboard" title="Hello Cedric!" subtitle="Your shared expenses at a glance">
    <app-dashboard-banner banner />
    <div content>
      <app-dashboard-actions />
      <app-dashboard-groups />
      <div class="dashboard-grid"><app-dashboard-recent-expenses /><app-dashboard-who-owes-whom /><app-dashboard-expenses-by-category /></div>
    </div>
  </app-authenticated-layout>`
})
export class DashboardPageComponent {}
