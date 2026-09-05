import { type ServerOptions } from '@modelcontextprotocol/server';

/** Freshness for results that change only when this server is redeployed. */
const BUILD_STATIC_TTL_MS = 3_600_000;

/** Freshness for results that track Arranger's catalogue configuration rather than our build. */
const ARRANGER_CONFIG_TTL_MS = 60_000;

/**
 * Freshness hints published on the six cacheable results (protocol revision `2026-07-28`). The SDK
 * default of `{ ttlMs: 0, cacheScope: 'private' }` tells every client to cache nothing, so leaving
 * this unset throws the feature away.
 *
 * `resources/list` tracks Arranger rather than the build despite the name: the catalogue resource is
 * a template whose `list` callback asks Arranger which catalogues exist.
 *
 * Typed against `ServerOptions` so a key that is not cacheable fails to compile; the SDK ignores one
 * rather than rejecting it.
 *
 * `private` means "do not share", not "do not cache".
 */
export const RESULT_CACHE_HINTS: NonNullable<ServerOptions['cacheHints']> = {
	'tools/list': { ttlMs: BUILD_STATIC_TTL_MS, cacheScope: 'public' },
	'prompts/list': { ttlMs: BUILD_STATIC_TTL_MS, cacheScope: 'public' },
	'resources/templates/list': { ttlMs: BUILD_STATIC_TTL_MS, cacheScope: 'public' },
	'server/discover': { ttlMs: BUILD_STATIC_TTL_MS, cacheScope: 'public' },
	'resources/list': { ttlMs: ARRANGER_CONFIG_TTL_MS, cacheScope: 'private' },
	'resources/read': { ttlMs: ARRANGER_CONFIG_TTL_MS, cacheScope: 'private' },
};
