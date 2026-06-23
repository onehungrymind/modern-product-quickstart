import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { LinksListComponent } from './links-list.component';
import { LinksFacade } from '@tracer/core-state';
import { linksFeature } from '@tracer/core-state';

describe('LinksListComponent', () => {
  let component: LinksListComponent;
  let fixture: ComponentFixture<LinksListComponent>;

  const mockFacade = {
    links$: of([]),
    loading$: of(false),
    loaded$: of(false),
    error$: of(null),
    loadLinks: vi.fn(),
    createLink: vi.fn(),
    selectLink: vi.fn(),
    loadLink: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinksListComponent],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            [linksFeature.name]: linksFeature.reducer(undefined, {
              type: '@@init',
            }),
          },
        }),
        { provide: LinksFacade, useValue: mockFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinksListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadLinks on init', () => {
    expect(mockFacade.loadLinks).toHaveBeenCalled();
  });

  it('should show empty state when no links', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('lib-empty-state')).toBeTruthy();
  });
});
