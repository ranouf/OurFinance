import { Routes } from '@angular/router';

export const securedRoutes: Routes = [
  { path: '', loadComponent: () => import('../templates/secured-layout/secured-layout.component').then(m => m.SecuredLayoutComponent), children: [
    { path: 'dashboard', loadComponent: () => import('../app-pages').then(m => m.DashboardPage) },
    { path: 'groups', loadComponent: () => import('../app-pages').then(m => m.GroupsPage) },
    { path: 'expenses', loadComponent: () => import('../app-pages').then(m => m.ExpensesPage) },
    { path: 'statistics', loadComponent: () => import('../app-pages').then(m => m.StatisticsPage) },
    { path: 'account', loadComponent: () => import('../app-pages').then(m => m.AccountPage) },
  ] },
];
