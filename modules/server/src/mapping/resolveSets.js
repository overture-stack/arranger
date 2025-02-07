import { get, isEmpty, uniq } from 'lodash';
import { v4 as uuid } from 'uuid';

import { ENV_CONFIG } from '@/config';
import { buildQuery } from '@/middleware';

import compileFilter from './utils/compileFilter';
import esSearch from './utils/esSearch';

const retrieveSetIds = async ({
	esClient,
	index,
	query,
	path,
	sort,
	BULK_SIZE = 1000,
	trackTotalHits = true,
}) => {
	const search = async ({ searchAfter } = {}) => {
		const body = {
			...(!isEmpty(query) && { query }),
			...(searchAfter && { search_after: searchAfter }),
		};

		const response = await esSearch(esClient)({
			index,
			sort: sort.map(({ fieldName, order }) => `${fieldName}:${order || 'asc'}`),
			size: BULK_SIZE,
			track_total_hits: trackTotalHits,
			body,
		});
		const ids = response.hits.hits.map((x) =>
			get(x, `_source.${path.split('__').join('.')}`, x._id || ''),
		);

		const nextSearchAfter = sort
			.map(({ fieldName }) => response.hits.hits.map((x) => x._source[fieldName] || x[fieldName]))
			.reduce((acc, vals) => [...acc, ...vals.slice(-1)], []);

		return {
			ids,
			searchAfter: nextSearchAfter,
			total: response.hits.total.value,
		};
	};
	const handleResult = async ({ searchAfter, total, ids = [] }) => {
		if (ids.length === total) return uniq(ids);
		const { ids: newIds, ...response } = await search({ searchAfter });
		return handleResult({ ...response, ids: [...ids, ...newIds] });
	};
	return handleResult(await search());
};

export const saveSet =
	({ types, getServerSideFilter }) =>
	async (obj, { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' }, context) => {
		const { nested_fieldNames: nestedFieldNames, index } = types.find(
			([, x]) => x.name === type,
		)[1];
		const { esClient } = context;

		const query = buildQuery({
			nestedFieldNames,
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
			sort: sort && sort.length ? sort : [{ fieldName: '_id', order: 'asc' }],
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
			index: ENV_CONFIG.ES_ARRANGER_SET_INDEX,
			id: body.setId,
			refresh: refresh.toLowerCase(),
			body,
		});

		return body;
	};
