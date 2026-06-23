import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@tracer/core-data';
import { ErrorBannerComponent } from '@tracer/material';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ErrorBannerComponent],
  template: `
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-card__title">
          {{ mode() === 'login' ? 'Sign in to Tracer' : 'Create an account' }}
        </h1>

        <lib-error-banner [error]="error()" />

        <form class="login-card__form" (ngSubmit)="submit()">
          @if (mode() === 'register') {
            <div class="field">
              <label class="field__label" for="name">Name</label>
              <input
                id="name"
                class="field__input"
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                autocomplete="name"
              />
            </div>
          }

          <div class="field">
            <label class="field__label" for="email">Email</label>
            <input
              id="email"
              class="field__input"
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              autocomplete="email"
            />
          </div>

          <div class="field">
            <label class="field__label" for="password">Password</label>
            <input
              id="password"
              class="field__input"
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
            />
          </div>

          <button class="btn-primary" type="submit" [disabled]="loading()">
            @if (loading()) {
              Submitting…
            } @else {
              {{ mode() === 'login' ? 'Sign in' : 'Register' }}
            }
          </button>
        </form>

        <p class="login-card__toggle">
          @if (mode() === 'login') {
            Don't have an account?
            <button class="btn-link" type="button" (click)="switchMode('register')">
              Register
            </button>
          } @else {
            Already have an account?
            <button class="btn-link" type="button" (click)="switchMode('login')">
              Sign in
            </button>
          }
        </p>
      </div>
    </div>
  `,
  styles: `
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: var(--spacing-md);
      background: var(--surface-0);
    }

    .login-card {
      background: var(--surface-1);
      border-radius: var(--radius-lg);
      padding: var(--spacing-xl);
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      box-shadow: 0 2px 16px rgb(0 0 0 / 8%);
    }

    .login-card__title {
      margin: 0;
      font-family: var(--font-sans);
      font-size: 1.5rem;
      color: var(--text-primary);
    }

    .login-card__form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .field__label {
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    .field__input {
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--surface-2);
      border-radius: var(--radius-md);
      font-family: var(--font-sans);
      font-size: 1rem;
      color: var(--text-primary);
      background: var(--surface-1);
      outline: none;
      transition: border-color 0.15s;
    }

    .field__input:focus {
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
      transition: background 0.15s;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-card__toggle {
      margin: 0;
      text-align: center;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .btn-link {
      background: none;
      border: none;
      padding: 0;
      color: var(--accent);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: underline;
    }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>('login');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  name = '';
  email = '';
  password = '';

  switchMode(m: Mode): void {
    this.mode.set(m);
    this.error.set(null);
  }

  submit(): void {
    this.loading.set(true);
    this.error.set(null);

    const obs =
      this.mode() === 'login'
        ? this.auth.login({ email: this.email, password: this.password })
        : this.auth.register({
            email: this.email,
            name: this.name,
            password: this.password,
          });

    obs.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/links']);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }
}
