import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { LoginInput, RegisterInput, User } from '@tracer/common-models';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../config/api-url.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  readonly currentUser = signal<User | null>(null);

  loadCurrentUser(): Observable<{ user: User }> {
    return this.http
      .get<{ user: User }>(`${this.apiUrl}/auth/me`)
      .pipe(tap((res) => this.currentUser.set(res.user)));
  }

  register(input: RegisterInput): Observable<{ user: User }> {
    return this.http
      .post<{ user: User }>(`${this.apiUrl}/auth/register`, input)
      .pipe(tap((res) => this.currentUser.set(res.user)));
  }

  login(input: LoginInput): Observable<{ user: User }> {
    return this.http
      .post<{ user: User }>(`${this.apiUrl}/auth/login`, input)
      .pipe(tap((res) => this.currentUser.set(res.user)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/auth/logout`, {})
      .pipe(tap(() => this.currentUser.set(null)));
  }
}
