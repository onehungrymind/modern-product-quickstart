import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedirectService } from './redirect.service';
import { LinkEntity } from '../links/entities/link.entity';
import { ClicksService } from '../clicks/clicks.service';

function makeLinkEntity(overrides: Partial<LinkEntity> = {}): LinkEntity {
  return {
    id: 'link-id-1',
    slug: 'abc1234',
    targetUrl: 'https://example.com',
    title: 'Example',
    ownerId: 'owner-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    expiresAt: null,
    ...overrides,
  } as LinkEntity;
}

interface LinkRepoMock {
  findOne: jest.Mock;
}

describe('RedirectService', () => {
  let service: RedirectService;
  let linkRepo: LinkRepoMock;
  const mockClicksService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    linkRepo = { findOne: jest.fn() };
    mockClicksService.record.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedirectService,
        { provide: getRepositoryToken(LinkEntity), useValue: linkRepo },
        { provide: ClicksService, useValue: mockClicksService },
      ],
    }).compile();

    service = module.get<RedirectService>(RedirectService);
  });

  it('resolves target_url for an active link', async () => {
    const link = makeLinkEntity();
    linkRepo.findOne.mockResolvedValue(link);

    const target = await service.resolveTarget('abc1234', {});

    expect(target).toBe('https://example.com');
  });

  it('records a click when resolving an active link', async () => {
    const link = makeLinkEntity();
    linkRepo.findOne.mockResolvedValue(link);

    await service.resolveTarget('abc1234', {
      ip: '1.2.3.4',
      userAgent: 'test-agent',
      referrer: 'https://google.com',
    });

    expect(mockClicksService.record).toHaveBeenCalledWith('link-id-1', {
      ip: '1.2.3.4',
      userAgent: 'test-agent',
      referrer: 'https://google.com',
    });
  });

  it('returns null for an unknown slug', async () => {
    linkRepo.findOne.mockResolvedValue(null);

    const target = await service.resolveTarget('unknown', {});

    expect(target).toBeNull();
    expect(mockClicksService.record).not.toHaveBeenCalled();
  });

  it('returns null for an expired link', async () => {
    const pastDate = new Date(Date.now() - 1000);
    const link = makeLinkEntity({ expiresAt: pastDate });
    linkRepo.findOne.mockResolvedValue(link);

    const target = await service.resolveTarget('abc1234', {});

    expect(target).toBeNull();
    expect(mockClicksService.record).not.toHaveBeenCalled();
  });

  it('resolves a non-expired link with a future expiry', async () => {
    const futureDate = new Date(Date.now() + 1_000_000);
    const link = makeLinkEntity({ expiresAt: futureDate });
    linkRepo.findOne.mockResolvedValue(link);

    const target = await service.resolveTarget('abc1234', {});

    expect(target).toBe('https://example.com');
  });
});
