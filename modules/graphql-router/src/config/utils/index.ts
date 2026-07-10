import { setsMapping } from '#schema/index.js';
import { type SearchClient } from '#searchClient/types.js';

export const initializeSets = async ({
	enableSets = false,
	enableDebug,
	esClient,
	setsIndex: setsIndexName,
}: {
	enableSets?: boolean;
	enableDebug?: boolean;
	esClient: SearchClient;
	setsIndex: string;
}): Promise<void> => {
	if (!enableSets) {
		return;
	}

	console.log(`\n------\nConfiguring Sets index: ${setsIndexName}`);

	if ((await esClient.indices.exists({ index: setsIndexName }))?.statusCode === 404) {
		console.log(`  - Attempting to create Sets index "${setsIndexName}"...`);
		try {
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
		} catch (error) {
			// Another catalogue instance created the index concurrently; goal state already achieved.
			if ((error as any)?.meta?.body?.error?.type === 'resource_already_exists_exception') {
				console.log('  - Sets index created concurrently by another instance. no work needed');
				return;
			}
			throw error;
		}
	} else {
		console.log('  - Index already exists. no work needed');
		enableDebug && console.debug(`    DEBUG: "${setsIndexName}" found`);
		console.log('\n  Success!');
	}
};
