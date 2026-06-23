import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { LinkEntity } from './entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';
import { URL_PREVIEW_PROVIDER } from '../ports/url-preview/url-preview.provider';
import { StubUrlPreviewProvider } from '../ports/url-preview/stub-url-preview.provider';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const OWNER_ID = 'owner-uuid-1234';

function makeLinkEntity(overrides: Partial<LinkEntity> = {}): LinkEntity {
  return {
    id: 'link-id-1',
    slug: 'abc1234',
    targetUrl: 'https://example.com',
    title: 'Example',
    ownerId: OWNER_ID,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    expiresAt: null,
    ...overrides,
  } as LinkEntity;
}

interface LinkRepoMock {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
}

interface ClickRepoMock {
  count: jest.Mock;
  find: jest.Mock;
}

describe('LinksService', () => {
  let service: LinksService;
  let linkRepo: LinkRepoMock;
  let clickRepo: ClickRepoMock;

  beforeEach(async () => {
    linkRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    clickRepo = {
      count: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: getRepositoryToken(LinkEntity), useValue: linkRepo },
        { provide: getRepositoryToken(ClickEntity), useValue: clickRepo },
        {
          provide: URL_PREVIEW_PROVIDER,
          useClass: StubUrlPreviewProvider,
        },
        {
          provide: FeatureFlagsService,
          useValue: { isEnabled: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
  });

  describe('create', () => {
    it('mints a unique slug when none provided', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      const saved = makeLinkEntity();
      linkRepo.create.mockReturnValue(saved);
      linkRepo.save.mockResolvedValue(saved);

      const result = await service.create(
        { target_url: 'https://example.com' },
        OWNER_ID,
      );

      expect(result.slug).toBeTruthy();
      expect(result.target_url).toBe('https://example.com');
      expect(result.owner_id).toBe(OWNER_ID);
    });

    it('uses provided slug when given', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      const saved = makeLinkEntity({ slug: 'myslug' });
      linkRepo.create.mockReturnValue(saved);
      linkRepo.save.mockResolvedValue(saved);

      const result = await service.create(
        { target_url: 'https://example.com', slug: 'myslug' },
        OWNER_ID,
      );

      expect(result.slug).toBe('myslug');
    });

    it('throws ConflictException when slug already taken', async () => {
      linkRepo.findOne.mockResolvedValue(makeLinkEntity());

      await expect(
        service.create(
          { target_url: 'https://example.com', slug: 'taken' },
          OWNER_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('retries slug minting on collision', async () => {
      // First call returns existing (collision), second returns null
      linkRepo.findOne
        .mockResolvedValueOnce(makeLinkEntity())
        .mockResolvedValue(null);
      const saved = makeLinkEntity({ slug: 'newslug' });
      linkRepo.create.mockReturnValue(saved);
      linkRepo.save.mockResolvedValue(saved);

      const result = await service.create(
        { target_url: 'https://example.com' },
        OWNER_ID,
      );
      expect(result).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('returns link dto when found', async () => {
      const entity = makeLinkEntity();
      linkRepo.findOne.mockResolvedValue(entity);

      const result = await service.findOne('link-id-1', OWNER_ID);

      expect(result.id).toBe('link-id-1');
      expect(result.owner_id).toBe(OWNER_ID);
    });

    it('throws NotFoundException when link not found', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when link belongs to another user', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('link-id-1', 'other-owner'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns links for owner ordered by createdAt desc', async () => {
      const links = [makeLinkEntity({ id: '1' }), makeLinkEntity({ id: '2' })];
      linkRepo.find.mockResolvedValue(links);

      const result = await service.findAll(OWNER_ID);

      expect(result).toHaveLength(2);
      expect(linkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: OWNER_ID },
          order: { createdAt: 'DESC' },
        }),
      );
    });
  });

  describe('getClickStats', () => {
    it('returns stats with total and recent', async () => {
      linkRepo.findOne.mockResolvedValue(makeLinkEntity());
      clickRepo.count.mockResolvedValue(10);
      clickRepo.find.mockResolvedValue([]);

      const stats = await service.getClickStats('link-id-1', OWNER_ID);

      expect(stats.link_id).toBe('link-id-1');
      expect(stats.total).toBe(10);
      expect(stats.recent).toEqual([]);
    });

    it('throws NotFoundException when link not owned by caller', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getClickStats('link-id-1', 'other-owner'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
