import type { Client } from '@elastic/elasticsearch';
import { type ConfigsObject } from '@overture-stack/arranger-types/configs';
import {
	chartsProperties,
	downloadProperties,
	facetsProperties,
	configRootProperties,
	tableProperties,
} from '@overture-stack/arranger-types/configs/constants';

import fallbackConfigs from '#config/index.js';
import { setsMapping } from '#schema/index.js';

export const initializeSets = async ({
	enableDebug,
	esClient,
	setsIndex: setsIndexName,
}: {
	enableDebug?: boolean;
	esClient: Client;
	setsIndex: string;
}): Promise<void> => {
	console.log('\n------\nConfiguring Sets index:');

	if ((await esClient.indices.exists({ index: setsIndexName }))?.statusCode === 404) {
		console.log(`  - Attempting to create Sets index "${setsIndexName}"...`);
		const setsIndex = await esClient.indices.create({
			index: setsIndexName,
			body: {
				mappings: {
					properties: setsMapping,
				},
			},
		});

		if (setsIndex) {
			console.log('\n  Success!');
			return;
		}

		throw new Error(`  Problem creating ${setsIndexName} index`);
	} else {
		console.log('  - Index already exists. no work needed');
		enableDebug && console.log(`    "${setsIndexName}" found`);
		console.log('\n  Success!');
	}
};

// FIXME: complete these values
export const makeDefaultConfigs = (): Partial<ConfigsObject> => ({
	[configRootProperties.CHARTS]: {
		[chartsProperties.QUERY]: '',
	},
	[configRootProperties.DOWNLOADS]: {
		[downloadProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]: fallbackConfigs.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS,
		[downloadProperties.MAX_DOWNLOAD_ROWS]: fallbackConfigs.MAX_DOWNLOAD_ROWS,
	},
	[configRootProperties.EXTENDED]: [],
	[configRootProperties.FACETS]: {
		[facetsProperties.AGGS]: [],
	},
	[configRootProperties.INDEX]: fallbackConfigs.ES_INDEX,
	[configRootProperties.MATCHBOX]: [],
	[configRootProperties.TABLE]: {
		[tableProperties.COLUMNS]: [],
		[tableProperties.MAX_RESULTS_WINDOW]: fallbackConfigs.MAX_RESULTS_WINDOW,
		[tableProperties.ROW_ID_FIELD_NAME]: fallbackConfigs.ROW_ID_FIELD_NAME,
	},
	[configRootProperties.NETWORK_AGGREGATION]: fallbackConfigs.NETWORK_AGGREGATIONS,
});
