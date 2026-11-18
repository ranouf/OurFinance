import { Component, inject } from '@angular/core';
import { App } from '../../app';
import { t } from '../../shared/utils/i18n';
import { StatisticsSummary } from '../../features/statistics/statistics-summary';
import { BalanceSummary } from '../../features/balances/balance-summary';
import { SettlementForm } from '../../features/settlements/settlement-form';
import { SettlementHistory } from '../../features/settlements/settlement-history';

@Component({
  imports: [StatisticsSummary, BalanceSummary, SettlementForm, SettlementHistory],
  templateUrl: './statistics.component.html',
})
export class StatisticsPage { readonly app = inject(App); readonly t = t; }
