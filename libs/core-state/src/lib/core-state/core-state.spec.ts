import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { vi } from 'vitest';
import { LinksFacade } from '../links/links.facade';
import { linksActions } from '../links/links.actions';
import { linksFeature } from '../links/links.feature';

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

  it('loadLinks() should dispatch loadLinks action', () => {
    facade.loadLinks();
    expect(store.dispatch).toHaveBeenCalledWith(linksActions.loadLinks());
  });

  it('selectLink() should dispatch selectLink action', () => {
    facade.selectLink('abc');
    expect(store.dispatch).toHaveBeenCalledWith(
      linksActions.selectLink({ id: 'abc' }),
    );
  });

  it('createLink() should dispatch createLink action', () => {
    const input = { target_url: 'https://example.com' };
    facade.createLink(input);
    expect(store.dispatch).toHaveBeenCalledWith(
      linksActions.createLink({ input }),
    );
  });
});

describe('linksEffects — loadLinks$', () => {
  it('should expose a loadLinks$ effect', async () => {
    const { loadLinks$ } = await import('../links/links.effects');
    expect(loadLinks$).toBeDefined();
  });
});
