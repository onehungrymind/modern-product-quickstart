import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'lib-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <p class="empty-state__message">{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xl);
      gap: var(--spacing-md);
      text-align: center;
    }

    .empty-state__message {
      color: var(--text-secondary);
      margin: 0;
      font-family: var(--font-sans);
    }
  `,
})
export class EmptyStateComponent {
  readonly message = input<string>('No items found.');
}
