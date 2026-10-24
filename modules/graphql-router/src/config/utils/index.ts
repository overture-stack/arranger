import { setsMapping } from '#schema/index.js';
import { logSeparator } from '#utils/label.js';
import { MIGRATION_GUIDE_URL } from '#utils/migrationGuide.js';
import { type SearchClient } from '#searchClient/types.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Whether an index's mapping stores each saved set's filter as data, as the sets index this version creates does. */
const storesFilterAsData = (indexMapping: unknown): boolean => {
	const sqon =
		isRecord(indexMapping) && isRecord(indexMapping.mappings) && isRecord(indexMapping.mappings.properties)
			? indexMapping.mappings.properties.sqon
			: undefined;

	return isRecord(sqon) && sqon.enabled === false;
};

/**
 * Checks an existing sets index, which keeps the mapping it was created with, against the one this version creates:
 * where it does not store each saved set's filter as data, it is named in a warning pointing at the migration
 * section. A mapping the engine will not show is reported as unchecked. Neither stops startup.
 */
const checkExistingSetsIndex = async ({
	esClient,
	label,
	setsIndexName,
}: {
	esClient: SearchClient;
	label?: string;
	setsIndexName: string;
}): Promise<void> => {
	try {
		const { body } = await esClient.indices.getMapping({ index: setsIndexName });
		const outdated = Object.entries(isRecord(body) ? body : {})
			.filter(([, indexMapping]) => !storesFilterAsData(indexMapping))
			.map(([indexName]) => indexName);

		if (outdated.length > 0) {
			console.warn(
				'sets.index_mapping_outdated',
				`The sets index "${setsIndexName}" (${outdated.join(', ')}) does not store each saved set's filter as data, as a sets index this version creates does. Recreate it as ${MIGRATION_GUIDE_URL}#sets-index-filter-as-data describes.`,
				{ ...(label && { catalogue: label }), indices: outdated },
			);
		}
	} catch (cause) {
		console.warn(
			'sets.index_mapping_unchecked',
			`The mapping of the sets index "${setsIndexName}" could not be read, so whether it stores each saved set's filter as data is unchecked.`,
			{ ...(label && { catalogue: label }), cause: cause instanceof Error ? cause.message : String(cause) },
		);
	}
};

export const initializeSets = async ({
	enableSets = false,
	enableDebug,
	esClient,
	label,
	setsIndex: setsIndexName,
}: {
	enableSets?: boolean;
	enableDebug?: boolean;
	esClient: SearchClient;
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. */
	label?: string;
	setsIndex: string;
}): Promise<void> => {
	if (!enableSets) {
		return;
	}

	console.log(`\n${logSeparator(label)}\nConfiguring Sets index: ${setsIndexName}`);

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
		await checkExistingSetsIndex({ esClient, label, setsIndexName });
		console.log('\n  Success!');
	}
};
