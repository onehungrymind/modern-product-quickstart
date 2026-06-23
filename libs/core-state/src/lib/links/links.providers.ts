import { makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { linksEffects } from './links.effects';
import { linksFeature } from './links.feature';

export function provideLinksFeature() {
  return makeEnvironmentProviders([
    provideState(linksFeature),
    provideEffects(linksEffects),
  ]);
}
