import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { AsyncPipe, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LinksService } from '@tracer/core-data';
import { LinksFacade } from '@tracer/core-state';
import {
  SpinnerComponent,
  ErrorBannerComponent,
  EmptyStateComponent,
} from '@tracer/material';
import type { ClickStats } from '@tracer/common-models';

@Component({
  selector: 'app-link-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    SlicePipe,
    RouterLink,
    SpinnerComponent,
    ErrorBannerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="detail-page">
      <a class="back-link" routerLink="/links">&larr; Back to links</a>

      @if (loading$ | async) {
        <div class="center">
          <lib-spinner />
        </div>
      } @else if (selectedLink$ | async; as link) {
        <div class="detail-card">
          <h1 class="detail-card__title">
            {{ link.title ?? '/' + link.slug }}
          </h1>

          <dl class="detail-card__meta">
            <div class="meta-row">
              <dt>Short URL</dt>
              <dd>
                <a
                  [href]="shortUrl(link.slug)"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ shortUrl(link.slug) }}</a>
              </dd>
            </div>
            <div class="meta-row">
              <dt>Target</dt>
              <dd>
                <a
                  [href]="link.target_url"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ link.target_url }}</a>
              </dd>
            </div>
            <div class="meta-row">
              <dt>Created</dt>
              <dd>{{ link.created_at | slice: 0 : 10 }}</dd>
            </div>
            @if (link.expires_at) {
              <div class="meta-row">
                <dt>Expires</dt>
                <dd>{{ link.expires_at | slice: 0 : 10 }}</dd>
              </div>
            }
          </dl>

          <!-- Click stats -->
          @if (clickStats()) {
            <section class="stats">
              <h2 class="stats__title">Click Stats</h2>
              <p class="stats__total">
                Total clicks: <strong>{{ clickStats()!.total }}</strong>
              </p>
              @if (clickStats()!.recent.length === 0) {
                <lib-empty-state message="No clicks recorded yet." />
              } @else {
                <ul class="stats__list">
                  @for (click of clickStats()!.recent; track click.id) {
                    <li class="stats__item">
                      <span>{{ formatDate(click.occurred_at) }}</span>
                      @if (click.country) {
                        <span class="stats__country">{{ click.country }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            </section>
          } @else if (statsLoading()) {
            <lib-spinner />
          }
        </div>
      } @else {
        <lib-empty-state message="Link not found." />
      }

      <lib-error-banner [error]="error()" />
    </div>
  `,
  styles: `
    .detail-page {
      max-width: 700px;
      margin: 0 auto;
      padding: var(--spacing-xl) var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }

    .back-link {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--accent);
      text-decoration: none;
      align-self: flex-start;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .center {
      display: flex;
      justify-content: center;
      padding: var(--spacing-xl);
    }

    .detail-card {
      background: var(--surface-1);
      border-radius: var(--radius-lg);
      padding: var(--spacing-xl);
      border: 1px solid var(--surface-2);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }

    .detail-card__title {
      margin: 0;
      font-family: var(--font-sans);
      font-size: 1.5rem;
      color: var(--text-primary);
    }

    .detail-card__meta {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .meta-row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: var(--spacing-sm);
      align-items: baseline;
    }

    .meta-row dt {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .meta-row dd {
      margin: 0;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-row dd a {
      color: var(--accent);
      text-decoration: none;
    }

    .meta-row dd a:hover {
      text-decoration: underline;
    }

    .stats__title {
      margin: 0 0 var(--spacing-sm);
      font-family: var(--font-sans);
      font-size: 1.125rem;
      color: var(--text-primary);
    }

    .stats__total {
      margin: 0 0 var(--spacing-md);
      font-family: var(--font-sans);
      color: var(--text-secondary);
    }

    .stats__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .stats__item {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--text-secondary);
      padding: var(--spacing-xs) 0;
      border-bottom: 1px solid var(--surface-2);
    }

    .stats__country {
      font-weight: 500;
      color: var(--text-primary);
    }
  `,
})
export class LinkDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly facade = inject(LinksFacade);
  private readonly linksService = inject(LinksService);

  readonly selectedLink$ = this.facade.selectedLink$;
  readonly loading$ = this.facade.loading$;

  readonly clickStats = signal<ClickStats | null>(null);
  readonly statsLoading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.facade.loadLink(this.id());
    this.facade.selectLink(this.id());
    this.loadStats();
  }

  shortUrl(slug: string): string {
    return `${location.origin}/${slug}`;
  }

  formatDate(isoString: string): string {
    return isoString.slice(0, 19).replace('T', ' ');
  }

  private loadStats(): void {
    this.statsLoading.set(true);
    this.linksService.getClicks(this.id()).subscribe({
      next: (stats) => {
        this.clickStats.set(stats);
        this.statsLoading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.statsLoading.set(false);
      },
    });
  }
}
