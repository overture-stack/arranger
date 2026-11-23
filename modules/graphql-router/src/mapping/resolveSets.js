import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { get, isEmpty, uniq } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import { AccessControlError, AccessControlUnavailableError } from '#accessControl/AccessControlError.js';
import { evaluateFilterCallback } from '#accessControl/filterCallback.js';
import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix, unwrapHits } from '#middleware/utils/nestingPrefix.js';
import { setFilterResolverFor } from '#sets/resolveSetFilters.js';
import { requesterOf, savedAttributionFor } from '#sets/setsAccess.js';
import { SetsDisabledError } from '#sets/SetsDisabledError.js';
import { recordsAttribution } from '#sets/setsIndexMapping.js';
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
		const ids = hits.map((x) => get(x, `_source.${path.split('__').join('.')}`, x._id || ''));

		return {
			ids,
			isLastPage: hits.length < BULK_SIZE,
			searchAfter: hits.at(-1)?.sort,
		};
	};
	const collect = async ({ searchAfter, ids = [] }) => {
		const page = await search({ searchAfter });
		const collected = [...ids, ...page.ids];
		if (page.isLastPage) {
			return uniq(collected);
		}

		return collect({ searchAfter: page.searchAfter, ids: collected });
	};
	return collect({});
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
 * @param {string} args.setsIndex the catalogue's own sets index.
 * @param {Array} args.types the catalogue's types.
 * @throws {SetsDisabledError} while saved sets are not enabled, before any engine call.
 * @throws {AccessControlUnavailableError} for a suspended principal, before anything is read or stored.
 * @throws {AccessControlError} where sets have owners and the sets index cannot record the mark, before any record
 *   is read or anything stored.
 */
export const saveSet =
	({ enableSets, getRequester, getServerSideFilter, setsIndex, types }) =>
	async (obj, { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' }, context) => {
		if (!enableSets) {
			throw new SetsDisabledError();
		}

		const requester = getRequester ? requesterOf({ context, getRequester }) : undefined;

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

		const { attribution, userId: savedUserId } = savedAttributionFor({ clientUserId: userId, requester });

		const catalogueType = types.find(([, x]) => x.name === type)[1];
		const { nested_fieldNames: nestedFieldNames, index, config } = catalogueType;
		const nestingPrefix = config?.[configOptionalProperties.NESTING_PREFIX];
		const serverSideFilter = evaluateFilterCallback({ context, getServerSideFilter, readPath: 'sets' });

		const resolveSets = setFilterResolverFor({ context, enableSets, esClient, getRequester, setsIndex });
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

		const ids = await retrieveSetIds({
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

		const body = {
			setId: uuid(),
			createdAt: Date.now(),
			ids,
			type,
			path,
			// A set records the client's filter only where that filter selected its ids.
			sqon: context.disableClientFilters ? null : sqon,
			...(marksRecorded && { attribution }),
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
