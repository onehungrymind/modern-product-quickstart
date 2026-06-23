/**
 * Integration tests for LinksService, ClicksService and RedirectService
 * against a real Postgres instance via @testcontainers/postgresql.
 *
 * Run:  npx nx run api:integration
 *   or: npx nx test api --testPathPattern="integration.spec"
 */

import 'reflect-metadata';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, Repository } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { LinkEntity } from '../links/entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';
import { LinksService } from './links.service';
import { ClicksService } from '../clicks/clicks.service';
import { RedirectService } from '../redirect/redirect.service';
import { StubUrlPreviewProvider } from '../ports/url-preview/stub-url-preview.provider';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Wire up a plain (non-NestJS) LinksService against real TypeORM repos. */
function buildLinksService(
  linkRepo: Repository<LinkEntity>,
  clickRepo: Repository<ClickEntity>,
): LinksService {
  const svc = new LinksService(linkRepo, clickRepo, new StubUrlPreviewProvider());
  return svc;
}

// ─── suite ──────────────────────────────────────────────────────────────────

describe('Integration – Links / Clicks / Redirect (real Postgres)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let linkRepo: Repository<LinkEntity>;
  let clickRepo: Repository<ClickEntity>;
  let linksService: LinksService;
  let clicksService: ClicksService;
  let redirectService: RedirectService;

  /** Owner UUID used across tests — not persisted (no FK on links→users). */
  const OWNER_ID = '00000000-0000-4000-a000-000000000001';

  // ── boot ──────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    // Start a real Postgres container (pulled once, cached by Docker layer cache)
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: [UserEntity, LinkEntity, ClickEntity],
      // synchronize is fine for a test DB — no migrations needed
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    linkRepo = dataSource.getRepository(LinkEntity);
    clickRepo = dataSource.getRepository(ClickEntity);

    // Build services directly — no NestJS DI container required
    clicksService = new ClicksService(clickRepo);
    linksService = buildLinksService(linkRepo, clickRepo);
    redirectService = new RedirectService(linkRepo, clicksService);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  // Clean tables between tests to keep them independent.
  // TypeORM v0.3 rejects delete({}) (empty criteria); use clear() instead.
  afterEach(async () => {
    await clickRepo.clear();
    await linkRepo.clear();
  });

  // ── 1. Create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('mints a unique slug, persists the link, and returns the Link DTO', async () => {
      const link = await linksService.create(
        { target_url: 'https://example.com/page' },
        OWNER_ID,
      );

      expect(link.id).toBeTruthy();
      expect(link.slug).toBeTruthy();
      expect(link.target_url).toBe('https://example.com/page');
      expect(link.owner_id).toBe(OWNER_ID);
      expect(link.expires_at).toBeNull();

      // Verify it's actually in the DB
      const inDb = await linkRepo.findOne({ where: { id: link.id } });
      expect(inDb).not.toBeNull();
      expect(inDb!.slug).toBe(link.slug);
    });

    it('two links get distinct slugs', async () => {
      const [a, b] = await Promise.all([
        linksService.create({ target_url: 'https://alpha.example.com' }, OWNER_ID),
        linksService.create({ target_url: 'https://beta.example.com' }, OWNER_ID),
      ]);

      expect(a.slug).not.toBe(b.slug);
    });

    it('honours an explicit slug when supplied', async () => {
      const link = await linksService.create(
        { target_url: 'https://example.com', slug: 'testslug' },
        OWNER_ID,
      );

      expect(link.slug).toBe('testslug');
    });

    it('throws ConflictException when the same explicit slug is used twice', async () => {
      await linksService.create(
        { target_url: 'https://first.example.com', slug: 'dupslug' },
        OWNER_ID,
      );

      await expect(
        linksService.create(
          { target_url: 'https://second.example.com', slug: 'dupslug' },
          OWNER_ID,
        ),
      ).rejects.toThrow('dupslug');
    });
  });

  // ── 2. Resolve + click recording ─────────────────────────────────────────

  describe('resolve + click recording', () => {
    it('resolves target URL for an active link and records a Click', async () => {
      const link = await linksService.create(
        { target_url: 'https://resolve.example.com' },
        OWNER_ID,
      );

      const target = await redirectService.resolveTarget(link.slug, {
        ip: '1.2.3.4',
        userAgent: 'test-agent/1',
        referrer: 'https://referrer.example.com',
      });

      expect(target).toBe('https://resolve.example.com');

      // Click is recorded fire-and-forget — give it a tick to land
      await new Promise((r) => setTimeout(r, 20));

      const clicks = await clickRepo.find({ where: { linkId: link.id } });
      expect(clicks).toHaveLength(1);
      expect(clicks[0]!.ipHash).toBeTruthy(); // SHA-256 hash, not raw IP
      expect(clicks[0]!.userAgent).toBe('test-agent/1');
    });

    it('a second resolve increments the click count', async () => {
      const link = await linksService.create(
        { target_url: 'https://count.example.com' },
        OWNER_ID,
      );

      await redirectService.resolveTarget(link.slug, { ip: '10.0.0.1' });
      await redirectService.resolveTarget(link.slug, { ip: '10.0.0.2' });

      // Allow fire-and-forget writes to settle
      await new Promise((r) => setTimeout(r, 30));

      const stats = await linksService.getClickStats(link.id, OWNER_ID);
      expect(stats.total).toBe(2);
      expect(stats.recent).toHaveLength(2);
    });

    it('analytics via getClickStats reflects click data', async () => {
      const link = await linksService.create(
        { target_url: 'https://analytics.example.com' },
        OWNER_ID,
      );

      await redirectService.resolveTarget(link.slug, {
        ip: '5.5.5.5',
        userAgent: 'Mozilla/5.0',
      });

      await new Promise((r) => setTimeout(r, 20));

      const stats = await linksService.getClickStats(link.id, OWNER_ID);
      expect(stats.link_id).toBe(link.id);
      expect(stats.total).toBe(1);
      expect(stats.recent[0]!.link_id).toBe(link.id);
      expect(stats.recent[0]!.user_agent).toBe('Mozilla/5.0');
    });

    it('returns null for an unknown slug', async () => {
      const target = await redirectService.resolveTarget('unknownslug99', {});
      expect(target).toBeNull();
    });
  });

  // ── 3. Expiry ─────────────────────────────────────────────────────────────

  describe('expiry', () => {
    it('resolves to null for a link with a past expiresAt', async () => {
      const link = await linksService.create(
        {
          target_url: 'https://expired.example.com',
          // 1 second in the past
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
        OWNER_ID,
      );

      const target = await redirectService.resolveTarget(link.slug, {});
      expect(target).toBeNull();
    });

    it('resolves normally for a link with a future expiresAt', async () => {
      const link = await linksService.create(
        {
          target_url: 'https://future.example.com',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
        OWNER_ID,
      );

      const target = await redirectService.resolveTarget(link.slug, {});
      expect(target).toBe('https://future.example.com');
    });
  });
});
