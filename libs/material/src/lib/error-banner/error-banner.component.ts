import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'lib-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', 'aria-live': 'assertive' },
  template: `
    @if (error()) {
      <div class="error-banner">
        <span class="error-banner__icon" aria-hidden="true">⚠</span>
        <span class="error-banner__message">{{ error() }}</span>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background: color-mix(in srgb, var(--error) 12%, transparent);
      border: 1px solid var(--error);
      border-radius: var(--radius-md);
      color: var(--error);
      font-family: var(--font-sans);
    }

    .error-banner__icon {
      flex-shrink: 0;
    }

    .error-banner__message {
      flex: 1;
    }
  `,
})
export class ErrorBannerComponent {
  readonly error = input<string | null | undefined>(null);
}
