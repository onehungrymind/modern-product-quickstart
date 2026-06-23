import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LinksService } from '../services/links.service';
import { API_URL } from '../config/api-url.token';

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
    service.list().subscribe();
    const req = httpController.expectOne('/api/links');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create() should POST to /api/links', () => {
    const input = { target_url: 'https://example.com' };
    service.create(input).subscribe();
    const req = httpController.expectOne('/api/links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({
      id: '1',
      slug: 'abcdefg',
      target_url: 'https://example.com',
      owner_id: '1',
      created_at: new Date().toISOString(),
    });
  });

  it('getOne() should GET /api/links/:id', () => {
    service.getOne('123').subscribe();
    const req = httpController.expectOne('/api/links/123');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: '123',
      slug: 'abcdefg',
      target_url: 'https://example.com',
      owner_id: '1',
      created_at: new Date().toISOString(),
    });
  });

  it('getClicks() should GET /api/links/:id/clicks', () => {
    service.getClicks('123').subscribe();
    const req = httpController.expectOne('/api/links/123/clicks');
    expect(req.request.method).toBe('GET');
    req.flush({ link_id: '123', total: 0, recent: [] });
  });
});
