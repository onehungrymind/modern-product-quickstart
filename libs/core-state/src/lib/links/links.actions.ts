import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { CreateLinkInput, Link } from '@tracer/common-models';

export const linksActions = createActionGroup({
  source: 'Links API',
  events: {
    'Load Links': emptyProps(),
    'Load Links Success': props<{ links: Link[] }>(),
    'Load Links Failure': props<{ error: string }>(),

    'Load Link': props<{ id: string }>(),
    'Load Link Success': props<{ link: Link }>(),
    'Load Link Failure': props<{ error: string }>(),

    'Create Link': props<{ input: CreateLinkInput }>(),
    'Create Link Success': props<{ link: Link }>(),
    'Create Link Failure': props<{ error: string }>(),

    'Select Link': props<{ id: string | null }>(),
  },
});
