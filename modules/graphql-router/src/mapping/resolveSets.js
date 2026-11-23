import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { get, isEmpty, uniq } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import { evaluateFilterCallback } from '#accessControl/filterCallback.js';
import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix, unwrapHits } from '#middleware/utils/nestingPrefix.js';
import { SetsDisabledError } from '#sets/SetsDisabledError.js';

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

export const saveSet =
	({ enableSets, getServerSideFilter, setsIndex, types }) =>
	async (obj, { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' }, context) => {
		if (!enableSets) {
			throw new SetsDisabledError();
		}

		const catalogueType = types.find(([, x]) => x.name === type)[1];
		const { nested_fieldNames: nestedFieldNames, index, config } = catalogueType;
		const nestingPrefix = config?.[configOptionalProperties.NESTING_PREFIX];
		const { esClient } = context;
		const serverSideFilter = evaluateFilterCallback({ context, getServerSideFilter });

		const query = buildQuery({
			caller: 'resolveSets',
			enableSets,
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
			userId,
			size: ids.length,
		};

		await esClient.index({
			index: setsIndex,
			id: body.setId,
			refresh: refresh.toLowerCase(),
			body,
		});

		return body;
	};
