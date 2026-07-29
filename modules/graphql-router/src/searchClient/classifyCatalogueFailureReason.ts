/** Machine-readable classification for a catalogue that failed to load, extend as new failure modes are identified. */
export const catalogueErrorCodes = {
	CONNECTION_ERROR: 'connection_error',
	INDEX_NOT_FOUND: 'index_not_found',
	MAPPING_FETCH_ERROR: 'mapping_fetch_error',
	UNKNOWN_ERROR: 'unknown_error',
} as const;

export type CatalogueErrorCode = (typeof catalogueErrorCodes)[keyof typeof catalogueErrorCodes];

/** A failed catalogue's error detail: a machine-readable `code` plus a short, safe-to-display `message`. */
export type CatalogueErrorDetail = {
	code: CatalogueErrorCode;
	message: string;
};

// Names used by both @elastic/elasticsearch and @opensearch-project/opensearch client errors
// for a failure to reach or get a timely response from the cluster, as opposed to a valid
// response reporting a client-side problem (e.g. a 404 for a missing index).
const CONNECTION_ERROR_NAMES = new Set(['ConnectionError', 'NoLivingConnectionsError', 'TimeoutError', 'RequestAbortedError']);

const MAX_CAUSE_DEPTH = 5;

type SearchClientErrorShape = { name?: string; statusCode?: number };

const isSearchClientError = (value: unknown): value is SearchClientErrorShape =>
	typeof value === 'object' &&
	value !== null &&
	('statusCode' in value || CONNECTION_ERROR_NAMES.has((value as Error).name));

/** Walks an `Error.cause` chain looking for the search-client error identifying the real failure, since callers between here and the client tend to rewrap it in a generic Error. */
const findSearchClientError = (error: unknown, depth = 0): SearchClientErrorShape | undefined => {
	if (!error || depth >= MAX_CAUSE_DEPTH) {
		return undefined;
	}

	if (isSearchClientError(error)) {
		return error;
	}

	return findSearchClientError((error as { cause?: unknown }).cause, depth + 1);
};

/**
 * Classifies why a catalogue failed to load into a machine-readable error code and a curated,
 * safe-to-expose message. Deliberately never echoes the raw underlying error text (which can
 * carry internal hostnames, ports, or other infra detail) into the returned message.
 */
export const classifyCatalogueFailureReason = (error: unknown): CatalogueErrorDetail => {
	const searchClientError = findSearchClientError(error);

	if (searchClientError?.statusCode === 404) {
		return {
			code: catalogueErrorCodes.INDEX_NOT_FOUND,
			message: 'The configured search index could not be found.',
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

	return {
		code: catalogueErrorCodes.UNKNOWN_ERROR,
		message: 'An unexpected error occurred while loading this catalogue.',
	};
};
