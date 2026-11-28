import { Component, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';
import { UiButton } from '../../shared/components/ui-button/ui-button';
import { ExpenseForm } from './expense-form';
import { ExpenseHistory } from './expense-history';
import { expenseText } from './expense-text';

@Component({
  imports: [UiButton, ExpenseForm, ExpenseHistory],
  templateUrl: './expenses-page.html',
})
export class ExpensesPage implements OnDestroy {
  readonly app = inject(App);
  readonly t = t;
  readonly expenseText = expenseText;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly showEditor = signal(this.route.snapshot.queryParamMap.get('action') === 'add');
  private lastAction = this.route.snapshot.queryParamMap.get('action');
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const action = params.get('action');
      if (action === 'add' && action !== this.lastAction) this.showEditor.set(true);
      this.lastAction = action;
    });
  }
  closeEditor(): void {
    this.showEditor.set(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  ngOnDestroy(): void { this.app.expenseDraftActive.set(false); }
}

