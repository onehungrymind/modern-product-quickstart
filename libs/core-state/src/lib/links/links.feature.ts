import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { Link } from '@tracer/common-models';
import { linksActions } from './links.actions';

export interface LinksState extends EntityState<Link> {
  selectedId: string | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

export const linksAdapter = createEntityAdapter<Link>();

const initialState: LinksState = linksAdapter.getInitialState({
  selectedId: null,
  loading: false,
  loaded: false,
  error: null,
});

export const linksFeature = createFeature({
  name: 'links',
  reducer: createReducer(
    initialState,

    on(linksActions.loadLinks, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(linksActions.loadLinksSuccess, (state, { links }) =>
      linksAdapter.setAll(links, { ...state, loading: false, loaded: true }),
    ),
    on(linksActions.loadLinksFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    on(linksActions.loadLink, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(linksActions.loadLinkSuccess, (state, { link }) =>
      linksAdapter.upsertOne(link, { ...state, loading: false }),
    ),
    on(linksActions.loadLinkFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    on(linksActions.createLink, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(linksActions.createLinkSuccess, (state, { link }) =>
      linksAdapter.addOne(link, { ...state, loading: false }),
    ),
    on(linksActions.createLinkFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    on(linksActions.selectLink, (state, { id }) => ({
      ...state,
      selectedId: id,
    })),
  ),
  extraSelectors: ({ selectLinksState, selectSelectedId }) => {
    const adapterSelectors = linksAdapter.getSelectors(selectLinksState);
    return {
      ...adapterSelectors,
      selectSelectedLink: createSelector(
        adapterSelectors.selectEntities,
        selectSelectedId,
        (entities, id) => (id != null ? (entities[id] ?? null) : null),
      ),
    };
  },
});
