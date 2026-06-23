import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { LinksService } from '@tracer/core-data';
import { catchError, exhaustMap, map, of, switchMap } from 'rxjs';
import { linksActions } from './links.actions';

export const loadLinks$ = createEffect(
  (actions$ = inject(Actions), linksService = inject(LinksService)) =>
    actions$.pipe(
      ofType(linksActions.loadLinks),
      switchMap(() =>
        linksService.list().pipe(
          map((links) => linksActions.loadLinksSuccess({ links })),
          catchError((err: Error) =>
            of(linksActions.loadLinksFailure({ error: err.message })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadLink$ = createEffect(
  (actions$ = inject(Actions), linksService = inject(LinksService)) =>
    actions$.pipe(
      ofType(linksActions.loadLink),
      switchMap(({ id }) =>
        linksService.getOne(id).pipe(
          map((link) => linksActions.loadLinkSuccess({ link })),
          catchError((err: Error) =>
            of(linksActions.loadLinkFailure({ error: err.message })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const createLink$ = createEffect(
  (actions$ = inject(Actions), linksService = inject(LinksService)) =>
    actions$.pipe(
      ofType(linksActions.createLink),
      exhaustMap(({ input }) =>
        linksService.create(input).pipe(
          map((link) => linksActions.createLinkSuccess({ link })),
          catchError((err: Error) =>
            of(linksActions.createLinkFailure({ error: err.message })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const linksEffects = {
  loadLinks$,
  loadLink$,
  createLink$,
};
