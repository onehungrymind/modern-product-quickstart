import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagEntity } from './entities/feature-flag.entity';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  const repo = { findOne: jest.fn() };

  beforeEach(async () => {
    repo.findOne.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: getRepositoryToken(FeatureFlagEntity), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(FeatureFlagsService);
  });

  it('returns the flag value from the database', async () => {
    repo.findOne.mockResolvedValue({ key: 'link_title_preview', enabled: true });
    expect(await service.isEnabled('link_title_preview')).toBe(true);
  });

  it('defaults to false when the flag row is missing', async () => {
    repo.findOne.mockResolvedValue(null);
    expect(await service.isEnabled('nope')).toBe(false);
  });

  it('caches within the TTL, then re-reads after it expires', async () => {
    repo.findOne.mockResolvedValue({ key: 'f', enabled: true });
    expect(await service.isEnabled('f', 1000)).toBe(true);
    // second call within TTL → cached, no second DB read
    repo.findOne.mockResolvedValue({ key: 'f', enabled: false });
    expect(await service.isEnabled('f', 2000)).toBe(true);
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    // past the 5s TTL → re-reads, sees the new value
    expect(await service.isEnabled('f', 7000)).toBe(false);
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });
});
