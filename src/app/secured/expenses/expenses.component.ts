import { Component, inject } from '@angular/core';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';
import { ExpenseForm } from '../../features/expenses/expense-form';
import { ExpenseHistory } from '../../features/expenses/expense-history';

@Component({
  imports: [ExpenseForm, ExpenseHistory],
  templateUrl: './expenses.component.html',
})
export class ExpensesPage { readonly app = inject(App); readonly t = t; }
