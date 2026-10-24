import { type SearchClient } from '#searchClient/types.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** How an index's mapping holds `attribution`, the mark recording how a set was saved. */
export const attributionMappingOf = (indexMapping: unknown): 'absent' | 'keyword' | 'other' => {
	const attribution =
		isRecord(indexMapping) && isRecord(indexMapping.mappings) && isRecord(indexMapping.mappings.properties)
			? indexMapping.mappings.properties.attribution
			: undefined;

	return attribution === undefined
		? 'absent'
		: isRecord(attribution) && attribution.type === 'keyword'
			? 'keyword'
			: 'other';
};

/**
 * Whether the sets index maps `attribution` as a keyword now, so a mark written to it is recorded and read back.
 * Read at each save rather than once at startup, since an index can be recreated after the router starts. Every
 * index the name reaches must map it so, and a mapping that cannot be read counts as one that does not.
 *
 * @param details the search client, and the sets index's name.
 */
export const recordsAttribution = ({ esClient, setsIndex }: { esClient: SearchClient; setsIndex: string }) =>
	Promise.resolve()
		.then(() => esClient.indices.getMapping({ index: setsIndex }))
		.then(
			({ body }) => {
				const indexMappings = Object.values(isRecord(body) ? body : {});

				return (
					indexMappings.length > 0 &&
					indexMappings.every((indexMapping) => attributionMappingOf(indexMapping) === 'keyword')
				);
			},
			() => false,
		);
