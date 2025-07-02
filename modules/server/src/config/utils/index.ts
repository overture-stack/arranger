import type { Client } from '@elastic/elasticsearch';

import { ENV_CONFIG } from '#config/index.js';
import { chartsProperties, type ConfigObject, configProperties } from '#config/types.js';
import { setsMapping } from '#schema/index.js';

export const initializeSets = async ({
	esClient,
	setsIndex: setsIndexParam,
}: {
	esClient: Client;
	setsIndex: string;
}): Promise<void> => {
	ENV_CONFIG.DEBUG_MODE && console.log(`Attempting to create Sets index "${setsIndexParam}"...`);

	if ((await esClient.indices.exists({ index: setsIndexParam }))?.statusCode === 404) {
		const setsIndex = await esClient.indices.create({
			index: setsIndexParam,
			body: {
				mappings: {
					properties: setsMapping,
				},
			},
		});

		if (setsIndex) {
			ENV_CONFIG.DEBUG_MODE && console.log('  Success!\n');
			return;
		}

		throw new Error(`Problem creating ${setsIndexParam} index`);
	} else {
		ENV_CONFIG.DEBUG_MODE && console.log(`  This index already exists. Moving on!\n`);
	}
};

export const makeConfigsFromEnv = (): Partial<ConfigObject> => ({
	[configProperties.CHARTS]: {
		[chartsProperties.QUERY]: '',
	},
	[configProperties.DOCUMENT_TYPE]: ENV_CONFIG.DOCUMENT_TYPE,
	[configProperties.DOWNLOADS]: {
		[configProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]: ENV_CONFIG.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS,
		[configProperties.MAX_DOWNLOAD_ROWS]: ENV_CONFIG.MAX_DOWNLOAD_ROWS,
	},
	[configProperties.EXTENDED]: [],
	[configProperties.FACETS]: {
		[configProperties.AGGS]: [],
	},
	[configProperties.INDEX]: ENV_CONFIG.ES_INDEX,
	[configProperties.MATCHBOX]: [],
	[configProperties.TABLE]: {
		[configProperties.COLUMNS]: [],
		[configProperties.MAX_RESULTS_WINDOW]: ENV_CONFIG.MAX_RESULTS_WINDOW,
		[configProperties.ROW_ID_FIELD_NAME]: ENV_CONFIG.ROW_ID_FIELD_NAME,
	},
	[configProperties.NETWORK_AGGREGATION]: ENV_CONFIG.NETWORK_AGGREGATIONS,
});
