import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      const message =
        err instanceof HttpErrorResponse
          ? (err.error as { message?: string })?.message ?? err.statusText
          : 'An unexpected error occurred';
      return throwError(() => new Error(message));
    }),
  );
