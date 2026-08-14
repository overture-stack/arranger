import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { get, isEmpty, uniq } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix, unwrapHits } from '#middleware/utils/nestingPrefix.js';

import compileFilter from './utils/compileFilter.js';
import esSearch from './utils/esSearch.js';

const retrieveSetIds = async ({
	esClient,
	index, // searchIndex
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

		const response = await esSearch(esClient)({
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

export const saveSet =
	({ getServerSideFilter, setsIndex, types }) =>
	async (obj, { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' }, context) => {
		const { nested_fieldNames: nestedFieldNames, index, config } = types.find(([, x]) => x.name === type)[1];
		const nestingPrefix = config?.[configOptionalProperties.NESTING_PREFIX];
		const { esClient } = context;

		const query = buildQuery({
			caller: 'resolveSets',
			nestedFieldNames,
			nestingPrefix,
			filters: compileFilter({
				clientSideFilter: sqon,
				serverSideFilter: getServerSideFilter(context),
			}),
		});

		const ids = await retrieveSetIds({
			esClient,
			index,
			query,
			path,
			nestingPrefix,
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
			sqon,
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
