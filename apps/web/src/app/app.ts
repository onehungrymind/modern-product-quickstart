import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--surface-0);
      font-family: var(--font-sans);
    }
  `,
})
export class App {}
