import { Component } from '@angular/core';
import { AuthenticatedLayoutComponent } from '../../layouts/authenticated-layout.component';
import { ExpensesBannerComponent } from './banner.component';
import { ExpensesHistoryComponent } from './history.component';
import { ExpensesExpenseFormComponent } from './expenseForm.component';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, ExpensesBannerComponent, ExpensesHistoryComponent, ExpensesExpenseFormComponent],
  template: `<app-authenticated-layout route="expenses" title="Expenses" subtitle="Track and split shared expenses with your group.">
    <app-expenses-banner banner />
    <div content class="expenses-layout"><app-expenses-history /><app-expenses-expense-form /></div>
  </app-authenticated-layout>`
})
export class ExpensesPageComponent {}
