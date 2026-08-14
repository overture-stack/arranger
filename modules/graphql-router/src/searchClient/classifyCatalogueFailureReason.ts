/** Machine-readable classification for a catalogue that failed to load, extend as new failure modes are identified. */
export const catalogueErrorCodes = {
	CONNECTION_ERROR: 'connection_error',
	INDEX_NOT_FOUND: 'index_not_found',
	MAPPING_FETCH_ERROR: 'mapping_fetch_error',
	NESTING_PREFIX_NOT_FOUND: 'nesting_prefix_not_found',
	PERMISSION_DENIED: 'permission_denied',
	SCHEMA_BUILD_ERROR: 'schema_build_error',
	UNKNOWN_ERROR: 'unknown_error',
} as const;

export type CatalogueErrorCode = (typeof catalogueErrorCodes)[keyof typeof catalogueErrorCodes];

/** A failed catalogue's error detail: a machine-readable `code` plus a short, safe-to-display `message`. */
export type CatalogueErrorDetail = {
	code: CatalogueErrorCode;
	message: string;
};

/** `Error.name` a caller sets to mark "this catalogue's GraphQL schema or endpoint failed to build", so it can be classified here without importing anything from the module that throws it. */
export const SCHEMA_BUILD_ERROR_NAME = 'SchemaBuildError';

/** `Error.name` set when a catalogue's configured `nestingPrefix` doesn't match anything in its real index mapping. */
export const NESTING_PREFIX_NOT_FOUND_ERROR_NAME = 'NestingPrefixNotFoundError';

// Names used by both @elastic/elasticsearch and @opensearch-project/opensearch client errors
// for a failure to reach or get a timely response from the cluster, as opposed to a valid
// response reporting a client-side problem (e.g. a 404 for a missing index).
const CONNECTION_ERROR_NAMES = new Set(['ConnectionError', 'NoLivingConnectionsError', 'TimeoutError', 'RequestAbortedError']);

const MAX_CAUSE_DEPTH = 5;

/** Walks an `Error.cause` chain looking for a value matching `matches`, since callers between here and the real failure tend to rewrap it in a generic Error. */
const findInCauseChain = <T>(error: unknown, matches: (value: unknown) => value is T, depth = 0): T | undefined => {
	if (!error || depth >= MAX_CAUSE_DEPTH) {
		return undefined;
	}

	if (matches(error)) {
		return error;
	}

	return findInCauseChain((error as { cause?: unknown }).cause, matches, depth + 1);
};

type SearchClientErrorShape = { name?: string; statusCode?: number };

const isSearchClientError = (value: unknown): value is SearchClientErrorShape =>
	typeof value === 'object' &&
	value !== null &&
	('statusCode' in value || CONNECTION_ERROR_NAMES.has((value as Error).name));

const isSchemaBuildError = (value: unknown): value is Error =>
	value instanceof Error && value.name === SCHEMA_BUILD_ERROR_NAME;

const isNestingPrefixNotFoundError = (value: unknown): value is Error =>
	value instanceof Error && value.name === NESTING_PREFIX_NOT_FOUND_ERROR_NAME;

/**
 * Classifies why a catalogue failed to load into a machine-readable error code and a curated,
 * safe-to-expose message. Deliberately never echoes the raw underlying error text (which can
 * carry internal hostnames, ports, or other infra detail) into the returned message.
 */
export const classifyCatalogueFailureReason = (error: unknown): CatalogueErrorDetail => {
	const searchClientError = findInCauseChain(error, isSearchClientError);

	if (searchClientError?.statusCode === 404) {
		return {
			code: catalogueErrorCodes.INDEX_NOT_FOUND,
			message: 'The configured search index could not be found.',
		};
	}

	if (searchClientError?.statusCode === 401 || searchClientError?.statusCode === 403) {
		return {
			code: catalogueErrorCodes.PERMISSION_DENIED,
			message: 'Access was denied while connecting to the search engine. Check the configured search engine user permissions.',
		};
	}

	if (searchClientError?.name && CONNECTION_ERROR_NAMES.has(searchClientError.name)) {
		return {
			code: catalogueErrorCodes.CONNECTION_ERROR,
			message: 'Could not connect to the search engine.',
		};
	}

	if (searchClientError) {
		return {
			code: catalogueErrorCodes.MAPPING_FETCH_ERROR,
			message: 'Could not fetch or parse the index mapping for this catalogue.',
		};
	}

	const nestingPrefixError = findInCauseChain(error, isNestingPrefixNotFoundError);

	if (nestingPrefixError) {
		return {
			code: catalogueErrorCodes.NESTING_PREFIX_NOT_FOUND,
			message: nestingPrefixError.message,
		};
	}

	const schemaBuildError = findInCauseChain(error, isSchemaBuildError);

	if (schemaBuildError) {
		// A schema/endpoint build failure's message already names the specific problem (e.g. which
		// field produced an invalid GraphQL name), and never carries infra detail like a host or port,
		// unlike the raw errors the other branches above deliberately keep out of this message.
		return {
			code: catalogueErrorCodes.SCHEMA_BUILD_ERROR,
			message:
				schemaBuildError.message ||
				'Could not build the GraphQL schema for this catalogue. Check its field, facet, and table configuration.',
		};
	}

	return {
		code: catalogueErrorCodes.UNKNOWN_ERROR,
		message: 'An unexpected error occurred while loading this catalogue.',
	};
};
