import { Readable } from 'node:stream';

import {
	configOptionalProperties,
	configRootProperties,
	downloadProperties,
} from '@overture-stack/arranger-types/configs/constants';

import { resolveServerSideFilter } from '#accessControl/resolveServerSideFilter.js';
import fallbackConfigs from '#config/index.js';
import compileFilter from '#mapping/utils/compileFilter.js';
import { isInvalidFilterError } from '#middleware/buildQuery/InvalidFilterError.js';
import { buildQuery, isESValueSafeJSInt } from '#middleware/index.js';
import { applyNestingPrefix, unwrapSource } from '#middleware/utils/nestingPrefix.js';
import { requestStateOf } from '#utils/context.js';

/**
 * An export refused for what its caller sent rather than for a fault on the server. The message names
 * what was wrong without repeating the value, since the value may have come from a client. The
 * `./download` entry point exports it so an integration can tell the outcomes apart as the router's
 * own `/download` does: this error is a bad request, answered with a 400, while an
 * `AccessControlError` is a refusal and any other error a server fault, both answered with a 500.
 */
export class InvalidExportRequestError extends Error {
	name = 'InvalidExportRequestError';
}

const requirePageSize = (chunkSize) => {
	if (Number.isInteger(chunkSize) && chunkSize > 0) {
		return chunkSize;
	}

	throw new InvalidExportRequestError('chunkSize must be a positive integer, sent as a JSON number.');
};

const SORT_ORDERS = ['asc', 'desc'];

const isSortEntry = (entry) =>
	typeof entry === 'object' &&
	entry !== null &&
	typeof entry.fieldName === 'string' &&
	entry.fieldName.length > 0 &&
	typeof entry.order === 'string' &&
	SORT_ORDERS.includes(entry.order.toLowerCase());

/**
 * Whether `sort` can order an export: an array, empty for the default order, of objects each naming a
 * non-empty `fieldName` and an `order` of `asc` or `desc` in any case. A hole in the array counts as
 * an entry, and is refused as one.
 *
 * @param {unknown} sort the value to check, as a caller or a client sent it.
 * @returns {boolean}
 */
export const isExportSort = (sort) => Array.isArray(sort) && Array.from(sort).every(isSortEntry);

const requireSort = (sort) => {
	if (isExportSort(sort)) {
		return sort.map(({ fieldName, order }) => ({ fieldName, order: order.toLowerCase() }));
	}

	throw new InvalidExportRequestError(
		'sort must be an array of entries, each with a non-empty fieldName and an order of asc or desc.',
	);
};

const compileQuery = (queryArguments) => {
	try {
		return buildQuery({ caller: 'getAllData', ...queryArguments });
	} catch (cause) {
		// A deployment's own filter compiles on every read path, so one that fails only here is the caller's.
		// A broken SQON rule is named, since its message never carries the filter's values; anything
		// else stays unnamed, since its message may describe the compiler's internals.
		throw new InvalidExportRequestError(
			isInvalidFilterError(cause)
				? `The export filter could not be compiled: ${cause.message}`
				: 'The export filter could not be compiled.',
			{ cause },
		);
	}
};

// A caller's 0 asks for the configured limit, and a configured 0 means no limit at all.
const rowLimitFor = ({ downloads, maxRows }) => {
	const limit =
		downloads[downloadProperties.ALLOW_CUSTOM_MAX_ROWS] && maxRows
			? maxRows
			: downloads[downloadProperties.MAX_ROWS];

	return limit > 0 ? limit : Infinity;
};

const searchAfterLastOf = (hits) => {
	const sortValues = hits.at(-1)?.sort;

	if (Array.isArray(sortValues)) {
		return sortValues.map(isESValueSafeJSInt);
	}

	throw new Error('A page of the export carried no sort values to continue after.');
};

// The engine's own failures are kept as the cause, for the server log: they can quote the caller's
// sort fields or filter values, so they never become the message. `query` is sent even if it compiled
// empty, which the engine refuses, where leaving it out would match every document.
const pageSearcher =
	({ esClient, index, query, sort }) =>
	async ({ searchAfter, size, trackTotalHits }) => {
		const { body } = await esClient
			.search({
				body: {
					query,
					...(searchAfter ? { search_after: searchAfter } : {}),
					sort,
					track_total_hits: trackTotalHits,
				},
				index,
				size,
			})
			.catch((cause) => {
				throw new Error('The search engine failed to return a page of the export.', { cause });
			});

		if ((body._shards?.failed ?? 0) === 0) {
			return { hits: body.hits.hits, total: body.hits.total?.value ?? body.hits.total };
		}

		throw new Error('A page of the export failed on some shards, so the export would be incomplete.', {
			cause: body._shards,
		});
	};

// Pulled one page at a time as the stream is read, so a consumer that stops reading stops the
// searches, and one that destroys the stream ends them after the page already requested.
async function* exportChunks({ chunkSize, nestingPrefix, rowLimit, searchPage }) {
	const firstSize = Math.min(chunkSize, rowLimit);
	const firstPage = await searchPage({ size: firstSize, trackTotalHits: true });
	const matchingTotal = firstPage.total;
	const total = typeof matchingTotal === 'number' ? Math.min(matchingTotal, rowLimit) : matchingTotal;
	// Additive beside `{ hits, total }`, so an export the limit cuts short says so to every reader.
	const truncated = typeof matchingTotal === 'number' && matchingTotal > rowLimit;

	let delivered = 0;
	let hits = firstPage.hits;
	let size = firstSize;

	while (hits.length > 0) {
		yield { hits: hits.map((hit) => unwrapSource(hit?._source, nestingPrefix)), matchingTotal, total, truncated };

		delivered += hits.length;
		const hasMore = hits.length >= size && delivered < rowLimit;
		const searchAfter = hasMore ? searchAfterLastOf(hits) : undefined;
		size = Math.min(chunkSize, rowLimit - delivered);
		hits = hasMore ? (await searchPage({ searchAfter, size, trackTotalHits: false })).hits : [];
	}
}

/**
 * Streams the documents an export selects as `{ hits, matchingTotal, total, truncated }` chunks, one per
 * search page, under the filter resolved from the context's access-control record and the caller's own
 * callback. `total` is capped at the row limit, `matchingTotal` is how many documents the filter matches,
 * and `truncated` says whether the limit cut the export short. Every refusal rejects the call before any
 * search, and a failed search or shard errors the stream.
 *
 * @template Context
 * @param {object} args
 * @param {number} [args.chunkSize] how many documents each page asks for, a positive integer, where leaving
 *   it out takes the catalogue's configured size, `DOWNLOAD_STREAM_BUFFER_SIZE`.
 * @param {Context} [args.ctx] the request context, normally the one a router built.
 * @param {import('@overture-stack/arranger-types/configs').GetServerSideFilterFn<Context>} [args.getServerSideFilter]
 *   a filter of the caller's own, which can only narrow the one the router recorded.
 * @param {number | null} [args.maxRows] the caller's row limit, honoured only when the catalogue allows
 *   custom row limits, where 0 asks for the configured one.
 * @param {{ fieldName: string, order: 'asc' | 'desc' }[]} [args.sort] the export's order, ahead of the
 *   `_id` tiebreaker: entries each naming a non-empty `fieldName` and an `order` of `asc` or `desc` in
 *   any case, where leaving it out or passing an empty array keeps the default order.
 * @param {unknown} [args.sqon] the caller's filter.
 * @returns {Promise<import('node:stream').Readable>}
 * @throws {AccessControlError} when no filter can be resolved or a callback cannot be evaluated.
 * @throws {InvalidExportRequestError} when `chunkSize` is not a positive integer, `sort` is not an array
 *   of such entries, or the filter cannot be compiled.
 */
export default async ({ chunkSize, ctx: givenContext = {}, getServerSideFilter, maxRows = null, sort = [], sqon }) => {
	const ctx = requestStateOf(givenContext);
	const serverSideFilter = resolveServerSideFilter({ context: ctx, getServerSideFilter });
	const { configs, esClient } = ctx;
	// A caller's own chunkSize wins, and is checked as the caller's input. Otherwise the catalogue's
	// DOWNLOAD_STREAM_BUFFER_SIZE pages the export where it is usable, as in 3.0, and the default where not,
	// since a server setting is never the request's fault.
	const configuredPageSize =
		configs.config?.[configRootProperties.DOWNLOADS]?.[downloadProperties.STREAM_BUFFER_SIZE];
	const pageSize =
		chunkSize === undefined
			? Number.isInteger(configuredPageSize) && configuredPageSize > 0
				? configuredPageSize
				: fallbackConfigs.downloads.chunkSize
			: requirePageSize(chunkSize);
	const exportSort = requireSort(sort);
	const nestingPrefix = configs.config?.[configOptionalProperties.NESTING_PREFIX];

	// From the mapping, like every other call site, rather than from `extendedFields`: nesting is an
	// index-mapping fact, and `extendedFields` falls back to raw file config whenever extending the
	// mapping throws, including when a catalogue simply has no `extended.json`. Every nested field has
	// to be listed here for its filters to compile as nested queries.
	//
	// Guarded rather than defaulted, because `buildQuery` defaults this argument to `[]`: a `configs`
	// that never went through `addMappingsToTypes` would otherwise reach the compiler with no nested
	// field listed, and nothing raised. Absent is a wiring fault, not "nothing nested".
	if (!Array.isArray(configs.nested_fieldNames)) {
		throw new Error(
			`Cannot build a download query for "${configs.name}": its configs carry no \`nested_fieldNames\`. ` +
				'That list comes from the index mapping via `addMappingsToTypes`, and every filter on a nested field ' +
				'needs it to compile as a nested query.',
		);
	}

	// Export is a read path like any other, so the access-control filter has to be composed here
	// too. Without this the caller's SQON reaches Elasticsearch alone and the export returns every
	// document the query matches, whatever the deployment's filter says.
	const query = compileQuery({
		filters: compileFilter({
			clientSideFilter: sqon,
			disableClientFilters: configs.config?.[configOptionalProperties.DISABLE_FILTERS] ?? false,
			serverSideFilter,
		}),
		nestedFieldNames: configs.nested_fieldNames,
		nestingPrefix,
		// A context the router built carries the catalogue's own sets index; one built elsewhere gets the
		// index a catalogue with no sets configuration uses.
		setsIndex: configs.setsIndex ?? fallbackConfigs.sets.index,
	});

	const esSort = exportSort
		.map(({ fieldName, order }) => ({ [applyNestingPrefix(fieldName, nestingPrefix)]: order }))
		.concat({ _id: 'asc' });

	return Readable.from(
		exportChunks({
			chunkSize: pageSize,
			nestingPrefix,
			rowLimit: rowLimitFor({ downloads: configs.config[configRootProperties.DOWNLOADS], maxRows }),
			searchPage: pageSearcher({ esClient, index: configs.index, query, sort: esSort }),
		}),
	);
};
