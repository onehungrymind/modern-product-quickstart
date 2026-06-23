import { Route } from '@angular/router';
import { authGuard } from '@tracer/core-data';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'links',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./links/links-list/links-list.component').then(
        (m) => m.LinksListComponent,
      ),
  },
  {
    path: 'links/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./links/link-detail/link-detail.component').then(
        (m) => m.LinkDetailComponent,
      ),
  },
  {
    path: '',
    redirectTo: 'links',
    pathMatch: 'full',
  },
];
