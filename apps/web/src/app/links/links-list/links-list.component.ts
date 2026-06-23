import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LinksFacade } from '@tracer/core-state';
import {
  EmptyStateComponent,
  SpinnerComponent,
  ErrorBannerComponent,
} from '@tracer/material';
import type { CreateLinkInput } from '@tracer/common-models';

@Component({
  selector: 'app-links-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    RouterLink,
    FormsModule,
    EmptyStateComponent,
    SpinnerComponent,
    ErrorBannerComponent,
  ],
  template: `
    <div class="links-page">
      <header class="links-page__header">
        <h1 class="links-page__title">My Links</h1>
      </header>

      <!-- Create form -->
      <form class="create-form" (ngSubmit)="create()">
        <input
          class="create-form__input"
          type="url"
          placeholder="https://example.com/long-url"
          [(ngModel)]="newUrl"
          name="newUrl"
          required
        />
        <button class="btn-primary" type="submit" [disabled]="createLoading()">
          {{ createLoading() ? 'Shortening…' : 'Shorten' }}
        </button>
      </form>

      <lib-error-banner [error]="(error$ | async) ?? null" />

      @if (loading$ | async) {
        <div class="center">
          <lib-spinner />
        </div>
      } @else if ((links$ | async)?.length === 0) {
        <lib-empty-state message="No links yet. Create your first short link above!" />
      } @else {
        <ul class="links-list" aria-label="Shortened links">
          @for (link of links$ | async; track link.id) {
            <li class="links-list__item">
              <a
                class="links-list__slug"
                [routerLink]="['/links', link.id]"
                aria-label="View details for {{ link.slug }}"
              >
                /{{ link.slug }}
              </a>
              <span class="links-list__target">{{ link.target_url }}</span>
              <span class="links-list__short">
                {{ shortUrl(link.slug) }}
              </span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .links-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--spacing-xl) var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }

    .links-page__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .links-page__title {
      margin: 0;
      font-family: var(--font-sans);
      font-size: 1.75rem;
      color: var(--text-primary);
    }

    .create-form {
      display: flex;
      gap: var(--spacing-sm);
    }

    .create-form__input {
      flex: 1;
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--surface-2);
      border-radius: var(--radius-md);
      font-family: var(--font-sans);
      font-size: 1rem;
      color: var(--text-primary);
      background: var(--surface-1);
      outline: none;
    }

    .create-form__input:focus {
      border-color: var(--accent);
    }

    .btn-primary {
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: var(--radius-md);
      font-family: var(--font-sans);
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .center {
      display: flex;
      justify-content: center;
      padding: var(--spacing-xl);
    }

    .links-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .links-list__item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: var(--surface-1);
      border-radius: var(--radius-md);
      border: 1px solid var(--surface-2);
    }

    .links-list__slug {
      font-family: var(--font-sans);
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
    }

    .links-list__slug:hover {
      text-decoration: underline;
    }

    .links-list__target {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .links-list__short {
      font-family: var(--font-sans);
      font-size: 0.75rem;
      color: var(--text-disabled);
      white-space: nowrap;
    }
  `,
})
export class LinksListComponent implements OnInit {
  private readonly facade = inject(LinksFacade);

  readonly links$ = this.facade.links$;
  readonly loading$ = this.facade.loading$;
  readonly loaded$ = this.facade.loaded$;
  readonly error$ = this.facade.error$;

  readonly createLoading = signal(false);

  newUrl = '';

  ngOnInit(): void {
    this.facade.loadLinks();
  }

  shortUrl(slug: string): string {
    return `${location.origin}/${slug}`;
  }

  create(): void {
    if (!this.newUrl) return;
    const input: CreateLinkInput = { target_url: this.newUrl };
    this.createLoading.set(true);
    this.facade.createLink(input);
    this.newUrl = '';
    // Reset loading after a tick — the store will update
    setTimeout(() => this.createLoading.set(false), 500);
  }
}
