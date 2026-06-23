/**
 * @tracer/common-models — the portable core.
 *
 * Zero framework dependencies (zod only). Both apps/api (enforce) and apps/web (render)
 * depend on it; it depends on neither. Schemas are the wire contract (snake_case); inferred
 * types are consumed identically on server and client.
 */
export * from './lib/schemas/user.schema';
export * from './lib/schemas/link.schema';
export * from './lib/schemas/click.schema';
export * from './lib/schemas/auth.schema';
export * from './lib/slug';
export * from './lib/expiry';
export * from './lib/url-safety';
