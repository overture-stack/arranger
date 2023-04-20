import { Client } from '@elastic/elasticsearch';

import { ENV_CONFIG } from '@/config/';
import { ConfigObject, ConfigProperties } from '@/config/types';
import { CONSTANTS } from '@/middleware';
import { setsMapping } from '@/schema';

export const initializeSets = async ({ esClient }: { esClient: Client }): Promise<void> => {
	ENV_CONFIG.DEBUG_MODE &&
		console.log(`Attempting to create Sets index "${CONSTANTS.ES_ARRANGER_SET_INDEX}"...`);

	if (
		(await esClient.indices.exists({ index: CONSTANTS.ES_ARRANGER_SET_INDEX }))?.statusCode === 404
	) {
		const setsIndex = await esClient.indices.create({
			index: CONSTANTS.ES_ARRANGER_SET_INDEX,
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

		throw new Error(`Problem creating ${CONSTANTS.ES_ARRANGER_SET_INDEX} index`);
	} else {
		ENV_CONFIG.DEBUG_MODE && console.log(`  This index already exists. Moving on!\n`);
	}
};

export const makeConfigsFromEnv = (): Partial<ConfigObject> => ({
	[ConfigProperties.DOCUMENT_TYPE]: ENV_CONFIG.DOCUMENT_TYPE,
	[ConfigProperties.DOWNLOADS]: {
		[ConfigProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]: ENV_CONFIG.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS,
		[ConfigProperties.MAX_DOWNLOAD_ROWS]: ENV_CONFIG.MAX_DOWNLOAD_ROWS,
	},
	[ConfigProperties.EXTENDED]: [],
	[ConfigProperties.FACETS]: {
		[ConfigProperties.AGGS]: [],
	},
	[ConfigProperties.INDEX]: ENV_CONFIG.ES_INDEX,
	[ConfigProperties.MATCHBOX]: [],
	[ConfigProperties.TABLE]: {
		[ConfigProperties.COLUMNS]: [],
		[ConfigProperties.MAX_RESULTS_WINDOW]: ENV_CONFIG.MAX_RESULTS_WINDOW,
		[ConfigProperties.KEY_FIELD_NAME]: ENV_CONFIG.KEY_FIELD_NAME,
	},
});
