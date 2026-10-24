import type { SqonNode } from '@overture-stack/sqon';
import { get } from 'lodash-es';

import { isIncludeEverythingFilter } from '#accessControl/includeEverything.js';
import compileFilter from '#mapping/utils/compileFilter.js';
import { catalogueSearch } from '#mapping/utils/esSearch.js';
import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix } from '#middleware/utils/nestingPrefix.js';
import type { SearchClient, SearchClientSearchBody } from '#searchClient/types.js';

/**
 * How many of a set's ids one search names: below the engine's default `index.max_terms_count` of 65,536, and no
 * more than its default `index.max_result_window` of 10,000, so one search fetches every record a chunk holds.
 */
export const SET_CHECK_CHUNK_SIZE = 10_000;

/** A saved set's contents, as the sets index stores them. */
export type StoredSet = Readonly<{ ids: readonly string[]; path: string; size: number }>;

const chunksOf = <Value>(values: readonly Value[], size: number): Value[][] =>
	Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
		values.slice(index * size, (index + 1) * size),
	);

type ExactAnswer = Readonly<{
	aggregations: SearchClientSearchBody['aggregations'];
	hits: { _id: string; _source?: unknown }[];
	total: number;
}>;

/** What a search answered, where the engine answered from every shard in time and counted exactly, and a rejection otherwise. */
const exactAnswerOf = (body: SearchClientSearchBody, catalogue: string): ExactAnswer => {
	const total = body.hits?.total;
	const exactTotal = typeof total === 'number' ? total : total?.relation === 'eq' ? total.value : undefined;

	if (body._shards.failed === 0 && body.timed_out === false && typeof exactTotal === 'number') {
		return { aggregations: body.aggregations, hits: body.hits?.hits ?? [], total: exactTotal };
	}

	throw new Error(`The search engine could not count a saved set's records in catalogue "${catalogue}" exactly.`, {
		cause: { _shards: body._shards, timed_out: body.timed_out },
	});
};

/**
 * A saved set as a reader may see it. Each chunk of its ids is counted twice in one search: the catalogue's
 * records holding those values, and the ones the reader's filter permits. Where every chunk's counts agree, the
 * set is served as stored. Otherwise each chunk that differs keeps only the values of records the reader may
 * see, fetched under their filter, and the size counts what is kept; nothing says what was withheld. A set whose
 * path lies inside a nested field cannot be counted per record, so nothing of it is served.
 *
 * @param details the catalogue the set was saved from, the reader's server-side filter, and the stored set.
 * @returns the ids and size the reader is served, or null where the set cannot be checked.
 * @throws {Error} when any search fails or is not answered exactly, rather than serving a set it could not count.
 */
export const narrowSetForReader = async ({
	catalogue,
	chunkSize = SET_CHECK_CHUNK_SIZE,
	esClient,
	index,
	legacyDateFieldNames,
	nestedFieldNames,
	nestingPrefix,
	serverSideFilter,
	set,
	setsIndex,
}: {
	catalogue: string;
	chunkSize?: number;
	esClient: SearchClient;
	index: string;
	legacyDateFieldNames: string[];
	nestedFieldNames: string[];
	nestingPrefix: string | undefined;
	serverSideFilter: SqonNode;
	set: StoredSet;
	setsIndex: string | undefined;
}): Promise<{ ids: string[]; size: number } | null> => {
	const storedIds = [...set.ids];
	const fieldName = set.path.split('__').join('.');
	const insideNestedField = nestedFieldNames.some(
		(nestedFieldName) => fieldName === nestedFieldName || fieldName.startsWith(`${nestedFieldName}.`),
	);

	if (insideNestedField) {
		return null;
	}

	const serverQuery = buildQuery({
		caller: 'narrowSet',
		filters: compileFilter({ clientSideFilter: undefined, serverSideFilter }),
		legacyDateFieldNames,
		nestedFieldNames,
		nestingPrefix,
		setsIndex,
	});

	if (isIncludeEverythingFilter(serverSideFilter) || Object.keys(serverQuery ?? {}).length === 0) {
		return { ids: storedIds, size: set.size };
	}

	const esFieldName = fieldName === '_id' ? '_id' : (applyNestingPrefix(fieldName, nestingPrefix) ?? fieldName);
	const search = catalogueSearch({ catalogue, esClient, readPath: 'sets', serverSideFilter });

	const countsAgree = async (chunk: string[]): Promise<boolean> => {
		const { body } = await search({
			body: {
				aggs: { permitted: { filter: serverQuery } },
				query: { terms: { [esFieldName]: chunk } },
				track_total_hits: true,
			},
			index,
			size: 0,
		});
		const { aggregations, total } = exactAnswerOf(body, catalogue);

		return aggregations?.permitted?.doc_count === total;
	};

	const permittedValuesOf = async (chunk: string[]): Promise<string[]> => {
		const { body } = await search({
			_source: esFieldName === '_id' ? false : [esFieldName],
			body: {
				query: { bool: { filter: [{ terms: { [esFieldName]: chunk } }, serverQuery] } },
				track_total_hits: true,
			},
			index,
			size: chunk.length,
		});
		const held = new Set(
			exactAnswerOf(body, catalogue).hits.flatMap((hit) =>
				esFieldName === '_id' ? [hit._id] : [get(hit._source, esFieldName)].flat(),
			),
		);

		return chunk.filter((value) => held.has(value));
	};

	const chunks = chunksOf(storedIds, chunkSize);
	const agreements = await Promise.all(chunks.map(countsAgree));

	if (agreements.every(Boolean)) {
		return { ids: storedIds, size: set.size };
	}

	const kept = await Promise.all(
		chunks.map((chunk, position) => (agreements[position] ? chunk : permittedValuesOf(chunk))),
	);
	const ids = kept.flat();

	return { ids, size: ids.length };
};
