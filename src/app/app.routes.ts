import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { galleryRoutes } from './gallery/gallery.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'login', loadComponent: () => import('./login-page').then(m => m.LoginPage) },
  { path: 'join', loadComponent: () => import('./app-pages').then(m => m.JoinPage) },
  { path: 'dashboard', loadComponent: () => import('./app-pages').then(m => m.DashboardPage) },
  { path: 'groups', loadComponent: () => import('./app-pages').then(m => m.GroupsPage) },
  { path: 'expenses', loadComponent: () => import('./app-pages').then(m => m.ExpensesPage) },
  { path: 'statistics', loadComponent: () => import('./app-pages').then(m => m.StatisticsPage) },
  { path: 'account', loadComponent: () => import('./app-pages').then(m => m.AccountPage) },
  ...(isDevMode() ? galleryRoutes : []),
  { path: '**', redirectTo: 'dashboard' },
];
