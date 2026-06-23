import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ClickStats,
  CreateLinkInput,
  Link,
} from '@tracer/common-models';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';

@Injectable({ providedIn: 'root' })
export class LinksService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  list(): Observable<Link[]> {
    return this.http.get<Link[]>(`${this.apiUrl}/links`);
  }

  getOne(id: string): Observable<Link> {
    return this.http.get<Link>(`${this.apiUrl}/links/${id}`);
  }

  create(input: CreateLinkInput): Observable<Link> {
    return this.http.post<Link>(`${this.apiUrl}/links`, input);
  }

  getClicks(id: string): Observable<ClickStats> {
    return this.http.get<ClickStats>(`${this.apiUrl}/links/${id}/clicks`);
  }
}
