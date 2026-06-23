import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { vi } from 'vitest';
import { LinksFacade } from './links.facade';
import { linksActions } from './links.actions';
import { linksFeature } from './links.feature';

describe('LinksFacade', () => {
  let facade: LinksFacade;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            [linksFeature.name]: linksFeature.reducer(undefined, {
              type: '@@init',
            }),
          },
        }),
        LinksFacade,
      ],
    });

    facade = TestBed.inject(LinksFacade);
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('loadLinks() dispatches loadLinks action', () => {
    facade.loadLinks();
    expect(store.dispatch).toHaveBeenCalledWith(linksActions.loadLinks());
  });

  it('loadLink() dispatches loadLink action', () => {
    facade.loadLink('abc-123');
    expect(store.dispatch).toHaveBeenCalledWith(
      linksActions.loadLink({ id: 'abc-123' }),
    );
  });

  it('selectLink() dispatches selectLink action', () => {
    facade.selectLink('abc-123');
    expect(store.dispatch).toHaveBeenCalledWith(
      linksActions.selectLink({ id: 'abc-123' }),
    );
  });

  it('selectLink(null) dispatches selectLink with null', () => {
    facade.selectLink(null);
    expect(store.dispatch).toHaveBeenCalledWith(
      linksActions.selectLink({ id: null }),
    );
  });

  it('createLink() dispatches createLink action', () => {
    const input = { target_url: 'https://example.com' };
    facade.createLink(input);
    expect(store.dispatch).toHaveBeenCalledWith(
      linksActions.createLink({ input }),
    );
  });
});
