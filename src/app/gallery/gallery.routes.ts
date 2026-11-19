import { Routes } from '@angular/router';

export const galleryRoutes: Routes = [
  { path: 'ui/components', loadComponent: () => import('../templates/gallery-layout/gallery-layout.component').then(m => m.GalleryLayoutComponent), children: [
    { path: '', loadComponent: () => import('./gallery/gallery.component').then(m => m.GalleryComponent) },
  ] },
];
