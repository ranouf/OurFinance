import { Routes } from '@angular/router';

export const authenticationRoutes: Routes = [
  { path: 'login', loadComponent: () => import('../templates/authentication-layout/authentication-layout.component').then(m => m.AuthenticationLayoutComponent), children: [
    { path: '', loadComponent: () => import('../app-pages').then(m => m.LoginPage) },
  ] },
  { path: 'join', loadComponent: () => import('../templates/authentication-layout/authentication-layout.component').then(m => m.AuthenticationLayoutComponent), children: [
    { path: '', loadComponent: () => import('../app-pages').then(m => m.JoinPage) },
  ] },
];
