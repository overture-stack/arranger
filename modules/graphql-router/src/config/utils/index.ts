import { setsMapping } from '#schema/index.js';
import { fieldMappingOf } from '#sets/setsIndexMapping.js';
import { logSeparator } from '#utils/label.js';
import { MIGRATION_GUIDE_URL } from '#utils/migrationGuide.js';
import { type SearchClient } from '#searchClient/types.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The marks a saved set records, which an existing sets index must map as keywords to record them. */
const MARKED_FIELDS = ['attribution', 'catalogue'] as const;
type MarkedField = (typeof MARKED_FIELDS)[number];

const MARK_DESCRIPTIONS: Record<MarkedField, string> = {
	attribution: 'how each set was saved',
	catalogue: 'which catalogue each set was saved from',
};

const MARK_MIGRATION_ANCHORS: Record<MarkedField, string> = {
	attribution: 'sets-index-attribution',
	catalogue: 'sets-index-per-catalogue',
};

/** Whether an index's mapping stores each saved set's filter as data, as the sets index this version creates does. */
const storesFilterAsData = (indexMapping: unknown): boolean => {
	const sqon =
		isRecord(indexMapping) && isRecord(indexMapping.mappings) && isRecord(indexMapping.mappings.properties)
			? indexMapping.mappings.properties.sqon
			: undefined;

	return isRecord(sqon) && sqon.enabled === false;
};

/**
 * Checks an existing sets index, which keeps the mapping it was created with, against the one this version creates.
 * Where it does not store each saved set's filter as data, it is named in a warning pointing at the migration
 * section. Where it lacks `attribution` or `catalogue`, the field is added as a keyword, which needs no reindex; where
 * that cannot be done, or the field is mapped as anything but a keyword, it is named in a warning. Each save reads
 * the mapping again, so no mark is written there until it is fixed. A mapping the engine will not show is reported
 * as unchecked. None of these stops startup.
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
	const catalogue = label ? { catalogue: label } : {};
	const indexMappings = await esClient.indices
		.getMapping({ index: setsIndexName })
		.then(({ body }) => Object.entries(isRecord(body) ? body : {}))
		.catch((cause: unknown) => {
			console.warn(
				'sets.index_mapping_unchecked',
				`The mapping of the sets index "${setsIndexName}" could not be read, so whether it stores each saved set's filter as data, and can record how each set was saved, is unchecked.`,
				{ ...catalogue, cause: cause instanceof Error ? cause.message : String(cause) },
			);

			return undefined;
		});

	if (!indexMappings) {
		return;
	}

	const filterOutdated = indexMappings
		.filter(([, indexMapping]) => !storesFilterAsData(indexMapping))
		.map(([indexName]) => indexName);

	if (filterOutdated.length > 0) {
		console.warn(
			'sets.index_mapping_outdated',
			`The sets index "${setsIndexName}" (${filterOutdated.join(', ')}) does not store each saved set's filter as data, as a sets index this version creates does. Recreate it as ${MIGRATION_GUIDE_URL}#sets-index-filter-as-data describes.`,
			{ ...catalogue, indices: filterOutdated },
		);
	}

	for (const field of MARKED_FIELDS) {
		await ensureKeywordField({ esClient, field, indexMappings, logFields: catalogue, setsIndexName });
	}
};

/**
 * Adds a mark field to an existing sets index as a keyword when the index lacks it, which needs no reindex. Where the
 * field is mapped as anything else, or cannot be added, it is named in a warning pointing at the migration section.
 */
const ensureKeywordField = async ({
	esClient,
	field,
	indexMappings,
	logFields,
	setsIndexName,
}: {
	esClient: SearchClient;
	field: MarkedField;
	/** The catalogue this index is checked for, in log output, when the router has a label. */
	logFields: { catalogue?: string };
	indexMappings: [string, unknown][];
	setsIndexName: string;
}): Promise<void> => {
	const fieldMappings = indexMappings.map(([, indexMapping]) => fieldMappingOf(indexMapping, field));

	if (fieldMappings.every((mapping) => mapping === 'keyword')) {
		return;
	}

	const fieldAdded =
		fieldMappings.every((mapping) => mapping !== 'other') &&
		(await Promise.resolve()
			.then(() =>
				esClient.indices.putMapping({
					body: { properties: { [field]: setsMapping[field] } },
					index: setsIndexName,
				}),
			)
			.then(
				() => true,
				() => false,
			));

	if (!fieldAdded) {
		const anchor = MARK_MIGRATION_ANCHORS[field];

		console.warn(
			'sets.index_mapping_outdated',
			`The sets index "${setsIndexName}" cannot record ${MARK_DESCRIPTIONS[field]}, since its mapping lacks \`${field}\` as a keyword and it could not be added, so no set records it, and while saved sets have owners, none is saved. Add it as ${MIGRATION_GUIDE_URL}#${anchor} describes.`,
			logFields,
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
