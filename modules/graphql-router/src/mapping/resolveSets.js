import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { get, isEmpty, uniq } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import { AccessControlError, AccessControlUnavailableError } from '#accessControl/AccessControlError.js';
import { evaluateFilterCallback } from '#accessControl/filterCallback.js';
import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix, unwrapHits } from '#middleware/utils/nestingPrefix.js';
import { requesterOf, savedAttributionFor } from '#sets/setsAccess.js';
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
			sort: sort.map(
				({ fieldName, order }) =>
					`${fieldName === '_id' ? fieldName : applyNestingPrefix(fieldName, nestingPrefix)}:${order || 'asc'}`,
			),
			size: BULK_SIZE,
			track_total_hits: trackTotalHits,
			body,
		});

		const hits = unwrapHits(response?.body?.hits, nestingPrefix);
		const ids = hits?.hits.map((x) => get(x, `_source.${path.split('__').join('.')}`, x._id || '')) || [];

		const nextSearchAfter = sort
			.map(({ fieldName }) => hits?.hits.map((x) => x._source[fieldName] || x[fieldName]))
			.reduce((acc, vals) => [...acc, ...vals.slice(-1)], []);

		return {
			ids,
			searchAfter: nextSearchAfter,
			total: hits?.total.value,
		};
	};
	const handleResult = async ({ searchAfter, total, ids = [] }) => {
		if (ids.length === total) return uniq(ids);
		const { ids: newIds, ...response } = await search({ searchAfter });
		return handleResult({
			...response,
			ids: [...ids, ...newIds],
		});
	};
	return handleResult(await search());
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
 * @param {Function} [args.getRequester] the host's answer to who made a request.
 * @param {Function} args.getServerSideFilter the filter callback the saved records are selected under.
 * @param {string} args.setsIndex the catalogue's own sets index.
 * @param {Array} args.types the catalogue's types.
 * @throws {AccessControlUnavailableError} for a suspended principal, before anything is read or stored.
 * @throws {AccessControlError} where sets have owners and the sets index cannot record the mark, before any record
 *   is read or anything stored.
 */
export const saveSet =
	({ getRequester, getServerSideFilter, setsIndex, types }) =>
	async (obj, { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' }, context) => {
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

		const query = buildQuery({
			caller: 'resolveSets',
			legacyDateFieldNames: catalogueType.legacyDateFieldNames,
			nestedFieldNames,
			nestingPrefix,
			filters: compileFilter({
				clientSideFilter: sqon,
				disableClientFilters: context.disableClientFilters,
				serverSideFilter,
			}),
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
