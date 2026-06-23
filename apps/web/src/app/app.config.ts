import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import {
  API_URL,
  AuthService,
  credentialsInterceptor,
  errorInterceptor,
} from '@tracer/core-data';
import { provideLinksFeature } from '@tracer/core-state';
import { firstValueFrom } from 'rxjs';
import { catchError, of } from 'rxjs';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([credentialsInterceptor, errorInterceptor]),
      withFetch(),
    ),
    provideStore({}),
    provideLinksFeature(),
    provideStoreDevtools({ maxAge: 50, logOnly: false }),
    { provide: API_URL, useValue: '/api' },
    provideAppInitializer(() =>
      firstValueFrom(
        inject(AuthService)
          .loadCurrentUser()
          .pipe(catchError(() => of(null))),
      ),
    ),
  ],
};
