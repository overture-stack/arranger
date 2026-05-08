import type { CatAliasesAliasesRecord } from '@elastic/elasticsearch/api/types';

import { type SearchClient } from '#searchClient/types.js';

const REQUEST_TIMEOUT = 10000;

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

export const fetchMapping = async ({
	enableDebug,
	esClient,
	esIndex,
}: {
	enableDebug?: boolean;
	esClient: SearchClient;
	esIndex: string;
}) => {
	if (esClient) {
		console.log(`  - Fetching ES mapping for "${esIndex}"`);

		try {
			const aliases = await getESAliases(esClient, REQUEST_TIMEOUT);
			const alias = checkESAlias(aliases, esIndex);
			alias && console.log(`    Found it as an alias for index "${alias}"`);

			const accessor = alias || esIndex;

			const mapping = await withSlowLog(
				esClient?.indices.getMapping(
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
