import { Routes } from '@angular/router';
import { authenticationRoutes } from './authentication/authentication.routes';
import { galleryRoutes } from './gallery/gallery.routes';
import { securedRoutes } from './secured/secured.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ...authenticationRoutes,
  ...galleryRoutes,
  ...securedRoutes,
  { path: '**', redirectTo: 'dashboard' },
];
