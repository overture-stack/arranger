import { setsMapping } from '#schema/index.js';
import { type SearchClient } from '#searchClient/types.js';

export const initializeSets = async ({
	enableDebug,
	esClient,
	setsIndex: setsIndexName,
}: {
	enableDebug?: boolean;
	esClient: SearchClient;
	setsIndex: string;
}): Promise<void> => {
	console.log(`\n------\nConfiguring Sets index: ${setsIndexName}`);

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
		enableDebug && console.debug(`    DEBUG: "${setsIndexName}" found`);
		console.log('\n  Success!');
	}
};
