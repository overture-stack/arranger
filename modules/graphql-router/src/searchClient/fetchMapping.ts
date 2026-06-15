import type { CatAliasesAliasesRecord } from '@elastic/elasticsearch/api/types';

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
			throw new Error(`Could not create a mapping`);
		}
	}

	throw new Error('fetchMapping did not receive an esClient');
};

/**
 * Fetches the ES index mapping and strips the reserved "id" field.
 * This is the main entry point for any code that needs an index mapping —
 * it owns the ES I/O and the one GraphQL-specific pre-processing step.
 *
 * TODO: Return type definition once SearchClient response types are merged
 */
export const getIndexMapping = async ({
	enableDebug,
	searchClient,
	esIndex,
}: {
	enableDebug: boolean;
	searchClient: SearchClient;
	esIndex: string;
}) => {
	if (searchClient && esIndex) {
		const { mapping } = await fetchMapping({
			enableDebug,
			searchClient,
			esIndex,
		});

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
