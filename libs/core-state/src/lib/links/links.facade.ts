import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import type { CreateLinkInput } from '@tracer/common-models';
import { linksActions } from './links.actions';
import { linksFeature } from './links.feature';

@Injectable({ providedIn: 'root' })
export class LinksFacade {
  private readonly store = inject(Store);

  readonly links$ = this.store.select(linksFeature.selectAll);
  readonly selectedLink$ = this.store.select(
    linksFeature.selectSelectedLink,
  );
  readonly loading$ = this.store.select(linksFeature.selectLoading);
  readonly loaded$ = this.store.select(linksFeature.selectLoaded);
  readonly error$ = this.store.select(linksFeature.selectError);

  loadLinks(): void {
    this.store.dispatch(linksActions.loadLinks());
  }

  loadLink(id: string): void {
    this.store.dispatch(linksActions.loadLink({ id }));
  }

  selectLink(id: string | null): void {
    this.store.dispatch(linksActions.selectLink({ id }));
  }

  createLink(input: CreateLinkInput): void {
    this.store.dispatch(linksActions.createLink({ input }));
  }
}
