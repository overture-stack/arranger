import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { get, isEmpty, uniq } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import {
	AccessControlDeniedError,
	AccessControlError,
	AccessControlUnavailableError,
} from '#accessControl/AccessControlError.js';
import { evaluateFilterCallback } from '#accessControl/filterCallback.js';
import includeEverything, { isIncludeEverythingFilter } from '#accessControl/includeEverything.js';
import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix, unwrapHits } from '#middleware/utils/nestingPrefix.js';
import { setFilterResolverFor } from '#sets/resolveSetFilters.js';
import { requesterOf, savedAttributionFor } from '#sets/setsAccess.js';
import { SetsDisabledError } from '#sets/SetsDisabledError.js';
import { exactAnswerOf, SET_CHECK_CHUNK_SIZE } from '#sets/narrowSet.js';
import { recordsAttribution, recordsCatalogue } from '#sets/setsIndexMapping.js';
import { chunksOf, setValuesTermsOf } from '#sets/setValues.js';
import { logEvent } from '#utils/logEvent.js';
import { MIGRATION_GUIDE_URL } from '#utils/migrationGuide.js';

import compileFilter from './utils/compileFilter.js';
import { catalogueSearch } from './utils/esSearch.js';

const retrieveSetIds = async ({
	index, // searchIndex
	searchCatalogue,
	query,
	path,
	sort,
	nestingPrefix,
	BULK_SIZE = 1000,
	trackTotalHits = true,
}) => {
	// Documents sharing every sort value have no fixed order between requests, so a sort not ending in `_id`
	// could skip or repeat them across pages.
	const engineSort = sort.at(-1)?.fieldName === '_id' ? sort : [...sort, { fieldName: '_id', order: 'asc' }];
	const sourcePath = `_source.${path.split('__').join('.')}`;

	const search = async ({ searchAfter } = {}) => {
		const body = {
			...(!isEmpty(query) && { query }),
			...(searchAfter && {
				search_after: searchAfter,
			}),
		};

		const response = await searchCatalogue({
			index,
			// `_id` is an ES meta field, never part of the document's own data, so it must never be
			// prefixed even when the catalogue's real fields live under a nestingPrefix envelope.
			sort: engineSort.map(
				({ fieldName, order }) =>
					`${fieldName === '_id' ? fieldName : applyNestingPrefix(fieldName, nestingPrefix)}:${order || 'asc'}`,
			),
			size: BULK_SIZE,
			track_total_hits: trackTotalHits,
			body,
		});

		const hits = unwrapHits(response?.body?.hits, nestingPrefix)?.hits ?? [];
		// A hit lacking the path saves its `_id` as its value, and is reported apart so a check can match it by `_id`.
		const pathlessHits = hits.filter((hit) => get(hit, sourcePath) === undefined);

		return {
			ids: hits.map((hit) => get(hit, sourcePath, hit._id || '')),
			isLastPage: hits.length < BULK_SIZE,
			pathValues: hits.map((hit) => get(hit, sourcePath)).filter((value) => value !== undefined),
			pathlessIds: pathlessHits.map((hit) => hit._id).filter(Boolean),
			searchAfter: hits.at(-1)?.sort,
		};
	};
	const collect = async ({ pathlessIds = [], pathValues = [], searchAfter, ids = [] }) => {
		const page = await search({ searchAfter });
		const collected = [...ids, ...page.ids];
		const collectedPathValues = [...pathValues, ...page.pathValues];
		const collectedPathlessIds = [...pathlessIds, ...page.pathlessIds];
		if (page.isLastPage) {
			return {
				ids: uniq(collected),
				pathlessIds: uniq(collectedPathlessIds),
				pathValues: uniq(collectedPathValues),
			};
		}

		return collect({
			pathlessIds: collectedPathlessIds,
			pathValues: collectedPathValues,
			searchAfter: page.searchAfter,
			ids: collected,
		});
	};
	return collect({});
};

/**
 * The searches that check a set's records against the artifact-create filter, one per chunk of at most `chunkSize`
 * values: the records whose saved path holds a chunk's values, and those whose `_id` is a chunk of the path-less ids.
 * Each search counts under the view filter with the create filter negated, and is answered exactly or refused.
 * Chunks run one after another and stop at the first chunk holding a record outside the filter.
 *
 * @param {object} args
 * @returns {Promise<boolean>} whether any record of the selection falls outside the create filter.
 * @throws {Error} when a search is not answered exactly, or the create filter cannot be compiled against the set
 *   (for example it names a saved set that was not resolved), so the save is refused rather than checked short.
 */
const anyRecordOutsideCreateFilter = async ({
	catalogue,
	chunkSize,
	createFilter,
	enableSets,
	esClient,
	index,
	legacyDateFieldNames,
	nestedFieldNames,
	nestingPrefix,
	path,
	pathlessIds,
	pathValues,
	resolvedSets,
	serverSideFilter,
	setsIndex,
}) => {
	const fieldName = path.split('__').join('.');

	if (nestedFieldNames.some((nested) => fieldName === nested || fieldName.startsWith(`${nested}.`))) {
		throw new AccessControlError(
			`The saved path "${path}" lies inside a nested field, which the artifact-create check cannot count per record.`,
		);
	}

	const viewAndNotCreate = compileFilter({
		clientSideFilter: undefined,
		disableClientFilters: false,
		serverSideFilter: { content: [serverSideFilter, { content: [createFilter], op: 'not' }], op: 'and' },
	});
	const serverQuery = buildQuery({
		caller: 'resolveSets',
		enableSets,
		legacyDateFieldNames,
		nestedFieldNames,
		nestingPrefix,
		filters: viewAndNotCreate,
		resolvedSets,
		setsIndex,
	});
	const search = catalogueSearch({ catalogue, esClient, readPath: 'sets', serverSideFilter });

	const holdsOutside = async (valuesClause) => {
		const response = await search({
			allow_partial_search_results: false,
			body: { query: { bool: { filter: [valuesClause, serverQuery] } }, track_total_hits: true },
			index,
			size: 0,
		});

		return exactAnswerOf(response.body, catalogue).total > 0;
	};

	const anyChunkHolds = async (chunks, valuesClauseOf) => {
		if (chunks.length === 0) {
			return false;
		}
		const [first, ...rest] = chunks;

		return (await holdsOutside(valuesClauseOf(first))) || anyChunkHolds(rest, valuesClauseOf);
	};

	const pathValueChunks = chunksOf(pathValues, chunkSize);
	const pathlessChunks = chunksOf(pathlessIds, chunkSize);

	return (
		(await anyChunkHolds(pathValueChunks, (values) => setValuesTermsOf({ fieldName, nestingPrefix, values }))) ||
		anyChunkHolds(pathlessChunks, (values) => setValuesTermsOf({ fieldName: '_id', nestingPrefix, values }))
	);
};

/**
 * The saveSet mutation's resolver. Each set records how it was saved, as its `attribution`: with the host's
 * `getRequester`, by the principal it names, whatever `userId` the client sends, or anonymously, and a suspended
 * principal saves nothing; without it, unattributed, keeping the `userId` the client sends as data. The saved set
 * is returned without its `userId`, which no reader is given. Where the sets index does not map `attribution` as a
 * keyword at the time of the save, a set is saved without the mark only when sets have no owners, since a set with no
 * mark is read as unattributed, and nothing is written into a field the index does not map.
 *
 * @param {object} args
 * @param {boolean} [args.enableSets] whether saved sets are enabled; a save is refused before anything is read when they are not.
 * @param {Function} [args.getRequester] the host's answer to who made a request.
 * @param {Function} args.getServerSideFilter the filter callback the saved records are selected under.
 * @param {number} [args.artifactCreateChunkSize] the most saved values one artifact-create check search names; a test may
 *   lower it. Defaults to `SET_CHECK_CHUNK_SIZE`.
 * @param {Function} [args.getArtifactCreateFilter] the records the requester may create an artifact from. Absent, no
 *   creation check runs; given, the set is refused when any of its records falls outside it.
 * @param {string} [args.setsIndex] the catalogue's own sets index, absent while saved sets are not enabled.
 * @param {object} [args.setsScope] the catalogue the saved set is recorded as belonging to, and scoped by under `getRequester`.
 * @param {Array} args.types the catalogue's types.
 * @throws {SetsDisabledError} while saved sets are not enabled, before any engine call.
 * @throws {AccessControlUnavailableError} for a suspended principal, before anything is read or stored.
 * @throws {AccessControlError} where sets have owners and the sets index cannot record the mark, before any record
 *   is read or anything stored.
 * @throws {AccessControlDeniedError} of kind `no-artifact-create` when a record the set would hold falls outside the
 *   artifact-create filter, before anything is stored; the set is saved whole or not at all.
 */
export const saveSet =
	({
		artifactCreateChunkSize = SET_CHECK_CHUNK_SIZE,
		enableSets,
		getArtifactCreateFilter,
		getRequester,
		getServerSideFilter,
		setsIndex,
		setsScope,
		types,
	}) =>
	async (obj, { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' }, context) => {
		if (!enableSets) {
			throw new SetsDisabledError();
		}

		// The host's callbacks answer first, so a refusal they make is logged by the host, with its own detail.
		const serverSideFilter = evaluateFilterCallback({ context, getServerSideFilter, readPath: 'sets' });
		const artifactCreateFilter = getArtifactCreateFilter
			? evaluateFilterCallback({ context, getServerSideFilter: getArtifactCreateFilter, readPath: 'sets' })
			: includeEverything(context);
		const requester = getRequester ? requesterOf({ context, getRequester }) : undefined;

		// A backstop for a host whose callbacks serve a suspended principal: a set cannot be given its creator yet.
		if (requester?.kind === 'suspended') {
			throw new AccessControlUnavailableError(
				'The requester is signed in but not confirmed, so no saved set can be given its creator yet.',
				{ retryAfterSeconds: requester.retryAfterSeconds },
			);
		}

		const { esClient } = context;
		const marksRecorded = await recordsAttribution({ esClient, setsIndex });

		if (requester && !marksRecorded) {
			throw new AccessControlError(
				`The sets index "${setsIndex}" does not map attribution as a keyword, so it cannot record who saved a set, and no set is saved while saved sets have owners. Add it as ${MIGRATION_GUIDE_URL}#sets-index-attribution describes.`,
			);
		}

		const catalogue = setsScope?.catalogue;
		const catalogueRecorded = catalogue !== undefined && (await recordsCatalogue({ esClient, setsIndex }));

		if (requester && !catalogueRecorded) {
			throw new AccessControlError(
				`The sets index "${setsIndex}" does not map catalogue as a keyword, so it cannot record which catalogue a set was saved from, and no set is saved while saved sets have owners. Add it as ${MIGRATION_GUIDE_URL}#sets-index-per-catalogue describes.`,
			);
		}

		const { attribution, userId: savedUserId } = savedAttributionFor({ clientUserId: userId, requester });

		const catalogueType = types.find(([, x]) => x.name === type)[1];
		const { nested_fieldNames: nestedFieldNames, index, config } = catalogueType;
		const nestingPrefix = config?.[configOptionalProperties.NESTING_PREFIX];

		const resolveSets = setFilterResolverFor({ context, enableSets, esClient, getRequester, setsIndex, setsScope });
		const compiledFilter = compileFilter({
			clientSideFilter: sqon,
			disableClientFilters: context.disableClientFilters,
			serverSideFilter,
		});
		const resolvedSets = await resolveSets(compiledFilter);
		const query = buildQuery({
			caller: 'resolveSets',
			enableSets,
			legacyDateFieldNames: catalogueType.legacyDateFieldNames,
			nestedFieldNames,
			nestingPrefix,
			filters: compiledFilter,
			resolvedSets,
			setsIndex,
		});

		const { ids, pathlessIds, pathValues } = await retrieveSetIds({
			index,
			query,
			path,
			nestingPrefix,
			searchCatalogue: catalogueSearch({
				catalogue: catalogueType.label ?? catalogueType.name,
				esClient,
				readPath: 'sets',
				serverSideFilter,
			}),
			sort:
				sort && sort.length
					? sort
					: [
							{
								fieldName: '_id',
								order: 'asc',
							},
						],
		});

		if (!isIncludeEverythingFilter(artifactCreateFilter) && ids.length > 0) {
			const catalogue = catalogueType.label ?? catalogueType.name;
			const holdsOutside = await anyRecordOutsideCreateFilter({
				catalogue,
				chunkSize: artifactCreateChunkSize,
				createFilter: artifactCreateFilter,
				enableSets,
				esClient,
				index,
				legacyDateFieldNames: catalogueType.legacyDateFieldNames ?? [],
				nestedFieldNames,
				nestingPrefix,
				path,
				pathlessIds,
				pathValues,
				resolvedSets,
				serverSideFilter,
				setsIndex,
			}).catch((error) => {
				logEvent('error', 'sets.artifact_create_check_failed', { catalogue, message: error.message, path });
				throw error;
			});

			if (holdsOutside) {
				throw new AccessControlDeniedError({ catalogue, kind: 'no-artifact-create' });
			}
		}

		const body = {
			setId: uuid(),
			createdAt: Date.now(),
			ids,
			type,
			path,
			// A set records the client's filter only where that filter selected its ids.
			sqon: context.disableClientFilters ? null : sqon,
			...(marksRecorded && { attribution }),
			...(catalogueRecorded && { catalogue }),
			userId: savedUserId,
			size: ids.length,
		};

		await esClient.index({
			index: setsIndex,
			id: body.setId,
			refresh: refresh.toLowerCase(),
			body,
		});

		return { ...body, userId: null };
	};
