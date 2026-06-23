import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LinksService } from './links.service';
import { API_URL } from '../config/api-url.token';
import type { Link } from '@tracer/common-models';

const MOCK_LINK: Link = {
  id: 'abc-123',
  slug: 'abcdefg',
  target_url: 'https://example.com',
  owner_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
};

describe('LinksService', () => {
  let service: LinksService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
        LinksService,
      ],
    });

    service = TestBed.inject(LinksService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should GET /api/links', () => {
    let result: Link[] | undefined;
    service.list().subscribe((links) => (result = links));

    const req = httpController.expectOne('/api/links');
    expect(req.request.method).toBe('GET');
    req.flush([MOCK_LINK]);
    expect(result).toEqual([MOCK_LINK]);
  });

  it('getOne() should GET /api/links/:id', () => {
    let result: Link | undefined;
    service.getOne('abc-123').subscribe((link) => (result = link));

    const req = httpController.expectOne('/api/links/abc-123');
    expect(req.request.method).toBe('GET');
    req.flush(MOCK_LINK);
    expect(result).toEqual(MOCK_LINK);
  });

  it('create() should POST /api/links', () => {
    const input = { target_url: 'https://example.com' };
    let result: Link | undefined;
    service.create(input).subscribe((link) => (result = link));

    const req = httpController.expectOne('/api/links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(MOCK_LINK);
    expect(result).toEqual(MOCK_LINK);
  });

  it('getClicks() should GET /api/links/:id/clicks', () => {
    const stats = { link_id: 'abc-123', total: 5, recent: [] };
    service.getClicks('abc-123').subscribe();

    const req = httpController.expectOne('/api/links/abc-123/clicks');
    expect(req.request.method).toBe('GET');
    req.flush(stats);
  });
});
