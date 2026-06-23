import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="spinner" role="status" aria-label="Loading">
      <span class="spinner__ring"></span>
    </span>
  `,
  styles: `
    .spinner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .spinner__ring {
      display: block;
      width: 32px;
      height: 32px;
      border: 3px solid var(--surface-2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class SpinnerComponent {}
