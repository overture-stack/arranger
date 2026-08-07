import type { CatAliasesAliasesRecord } from '@elastic/elasticsearch/api/types';

import { NESTING_PREFIX_NOT_FOUND_ERROR_NAME } from './classifyCatalogueFailureReason.js';
import type { SearchClient } from './types.js';

const REQUEST_TIMEOUT = 10000;

/**
 * Awaits a promise and logs warnings to the console if it is taking longer than expected.
 * Two warnings are emitted: one at 1.5x the threshold and one at 3x the threshold.
 * Timers are always cleared when the promise settles.
 *
 * @param promise - The promise to await.
 * @param label - A human-readable name for the operation, used in warning messages.
 * @param thresholdMs - Duration in milliseconds before slow-log warnings begin firing. Defaults to one quarter of `REQUEST_TIMEOUT`.
 * @returns The resolved value of the promise.
 */
const withSlowLog = async <T>(promise: Promise<T>, label: string, thresholdMs = REQUEST_TIMEOUT / 4): Promise<T> => {
	const firstTimeoutId = setTimeout(() => {
		console.warn(`    Still waiting for ${label}`);
	}, thresholdMs * 1.5);
	const secondTimeoutId = setTimeout(() => {
		console.warn(`    Will wait ${thresholdMs / 1000} seconds longer`);
	}, thresholdMs * 3);

	try {
		return await promise;
	} finally {
		clearTimeout(firstTimeoutId);
		clearTimeout(secondTimeoutId);
	}
};

export const getESAliases = async (esClient: SearchClient, requestTimeout?: number) => {
	const { body } = await withSlowLog(
		esClient.cat.aliases({ error_trace: false, format: 'json' }, { requestTimeout }),
		'ES aliases',
	);

	return body;
};

export const checkESAlias = (aliases: CatAliasesAliasesRecord[], possibleAlias: string) =>
	aliases?.find((foundIndex = { alias: undefined }) => foundIndex.alias === possibleAlias)?.index;

/**
 * Fetches the search engine field mappings for a given index, resolving aliases if present.
 *
 * Resolves the index alias if one exists, then retrieves the index mapping from the search engine.
 * Throws if the search client is missing, the index cannot be found, or the response cannot be parsed.
 *
 * @param enableDebug - When `true`, caught errors are logged to `console.debug` before being rethrown.
 * @param searchClient - The SearchClient used to perform requests of the search engine.
 * @param esIndex - The index name or alias to fetch the mapping for.
 * @returns An object containing the resolved `index` name, full `mappings` response for the index, field-level `mapping` properties, and the `alias` if one was found.
 */
export const fetchMapping = async ({
	enableDebug,
	searchClient,
	esIndex,
}: {
	enableDebug?: boolean;
	searchClient: SearchClient;
	esIndex: string;
}) => {
	if (searchClient) {
		console.log(`  - Fetching ES mapping for "${esIndex}"`);

		try {
			const aliases = await getESAliases(searchClient, REQUEST_TIMEOUT);
			const alias = checkESAlias(aliases, esIndex);
			alias && console.log(`    Found it as an alias for index "${alias}"`);

			const accessor = alias || esIndex;

			const mapping = await withSlowLog(
				searchClient?.indices.getMapping(
					{
						index: accessor,
					},
					{
						requestTimeout: REQUEST_TIMEOUT,
					},
				),
				`ES mapping for "${accessor}"`,
			).then((response) => {
				const mappings = response?.body?.[accessor];

				if (mappings) {
					const mapping = mappings?.mappings?.properties;
					return { index: accessor, mappings, mapping, alias };
				}

				console.info(`    Response could not be used to map "${accessor}":`, response?.body);
				throw new Error('cannot use response');
			});

			return mapping;
		} catch (err) {
			enableDebug && console.debug(`\n  DEBUG: ${err}`);
			throw new Error(`Could not create a mapping`, { cause: err });
		}
	}

	throw new Error('fetchMapping did not receive an esClient');
};

/**
 * Unwraps a mapping's fields from beneath a configured `nestingPrefix` (e.g. "data"), so a
 * catalogue whose real documents wrap all their content inside one top-level property (a data
 * source's own envelope shape, not something Arranger's own config should have to mirror) can
 * still be configured with clean, unprefixed field names in extended.json/facets.json/table.json.
 * A dotted prefix (e.g. "envelope.payload") walks down through that many nested levels.
 *
 * A configured `nestingPrefix` that doesn't match the real mapping throws rather than silently
 * falling back to the unwrapped mapping: the resulting schema would build fine but show every
 * field as null, the exact symptom this feature exists to fix, now self-inflicted by a config
 * typo with nothing but a log line as a clue. Throwing instead surfaces it as a real catalogue
 * failure (`nesting_prefix_not_found`) through the same partial-availability mechanism other
 * mapping problems already use.
 *
 * @param mapping - The raw ES mapping properties tree, as returned by `fetchMapping`. Untyped (`any`) to match `fetchMapping`'s own current return typing; see its `TODO`.
 * @param nestingPrefix - The dotted path, if any, that the mapping's real fields are nested under.
 * @returns The mapping properties found at `nestingPrefix`, or `mapping` unchanged if no prefix is configured.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unwrapMapping = (mapping: any, nestingPrefix?: string) => {
	if (!nestingPrefix || !mapping) {
		return mapping;
	}

	const unwrapped = nestingPrefix
		.split('.')
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.reduce((node: any, segment) => node?.[segment]?.properties, mapping);

	if (!unwrapped) {
		throw Object.assign(new Error(`Configured nestingPrefix "${nestingPrefix}" was not found in the index mapping.`), {
			name: NESTING_PREFIX_NOT_FOUND_ERROR_NAME,
		});
	}

	return unwrapped;
};

/**
 * Fetches the ES index mapping, unwraps it from beneath an optional `nestingPrefix`, and strips
 * the reserved "id" field. This is the main entry point for any code that needs an index mapping:
 * it owns the ES I/O and the GraphQL-specific pre-processing steps.
 *
 * TODO: Return type definition once SearchClient response types are merged
 */
export const getIndexMapping = async ({
	enableDebug,
	nestingPrefix,
	searchClient,
	esIndex,
}: {
	enableDebug?: boolean;
	nestingPrefix?: string;
	searchClient: SearchClient;
	esIndex: string;
}) => {
	if (searchClient && esIndex) {
		const { mapping: mappingFromIndex } = await fetchMapping({
			enableDebug,
			searchClient,
			esIndex,
		});

		const mapping = unwrapMapping(mappingFromIndex, nestingPrefix);

		if (mapping && Object.hasOwn(mapping, 'id')) {
			// FIXME: Figure out a solution to map this to something else rather than dropping it
			enableDebug &&
				console.debug('    DEBUG: Detected reserved field "id" in mapping, dropping it from GraphQL...');
			delete mapping.id;
		}
		return mapping;
	}

	throw new Error(`  Could not get ES mappings for ${esIndex}`);
};
