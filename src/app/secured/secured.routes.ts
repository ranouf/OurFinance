import { Routes } from '@angular/router';

export const securedRoutes: Routes = [
  { path: '', loadComponent: () => import('../templates/secured-layout/secured-layout.component').then(m => m.SecuredLayoutComponent), children: [
    { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardPage) },
    { path: 'groups', loadComponent: () => import('./groups/groups.component').then(m => m.GroupsPage) },
    { path: 'expenses', loadComponent: () => import('./expenses/expenses.component').then(m => m.ExpensesPage) },
    { path: 'statistics', loadComponent: () => import('./statistics/statistics.component').then(m => m.StatisticsPage) },
    { path: 'account', loadComponent: () => import('./account/account.component').then(m => m.AccountPage) },
  ] },
];
