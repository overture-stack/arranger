import getFields from 'graphql-fields';
import { chunk } from 'lodash';

import { buildQuery } from '@/middleware';

import compileFilter from './utils/compileFilter';
import esSearch from './utils/esSearch';

const findCopyToSourceFields = (mapping, path = '', results = {}) => {
	Object.entries(mapping).forEach(([k, v]) => {
		if (v.type === 'nested') {
			findCopyToSourceFields(v.properties, k, results);
		} else if (Object.keys(v).includes('copy_to')) {
			const fullPath = path ? `${path}.${k}` : k;
			const copy_to = v.copy_to[0];
			results[copy_to] = [...(results[copy_to] || []), fullPath];
		}
	});
	return results;
};

export const hitsToEdges = ({
	copyToSourceFields = {},
	extendedFields = [],
	hits,
	nestedFieldNames,
	Parallel,
	systemCores = process?.env?.SYSTEM_CORES || 2,
}) => {
	const extendedFieldsObj = extendedFields.reduce(
		(acc, field) => ({
			...acc,
			[field.fieldName]: field,
		}),
		{},
	);

	/*
    If there's a large request, we'll trigger ludicrous mode and do some parallel
    map-reduce based on # of cores available. Otherwise, only one child-process
    is spawn for compute
  */
	const dataSize = hits.hits.length;
	const chunks = chunk(
		hits.hits,
		dataSize > 1000 ? dataSize / systemCores + (dataSize % systemCores) : dataSize,
	);
	return Promise.all(
		chunks.map(
			(chunk) =>
				//Parallel.spawn output has a .then but it's not returning an actual promise
				new Promise((resolve) => {
					new Parallel({ copyToSourceFields, extendedFieldsObj, hits: chunk, nestedFieldNames })
						.spawn(({ copyToSourceFields, extendedFieldsObj, hits, nestedFieldNames }) => {
							/*
                everthing inside spawn is executed in a separate thread, so we have
                to use good old ES5 and require for run-time dependecy bundling.
              */
							const { isObject, flattenDeep } = require('lodash');
							const jp = require('jsonpath/jsonpath.min');

							const resolveCopiedTo = ({ node }) => {
								const foundValues = Object.entries(copyToSourceFields).reduce((acc, pair) => {
									const copyToField = pair[0];
									const sourceField = pair[1];
									const found = {};
									found[copyToField] = flattenDeep(
										sourceField.map((path) =>
											jp.query(
												node,
												path
													.split('.')
													.reduce(
														(acc, part, index) => (index === 0 ? `$.${part}` : `${acc}..${part}`),
														'',
													),
											),
										),
									);
									return found;
								}, {});
								return foundValues;
							};

							return hits.map((x) => {
								const joinParent = (parent, fieldName) =>
									parent ? `${parent}.${fieldName}` : fieldName;

								const resolveNested = ({ node, nestedFieldNames, parent = '' }) => {
									if (!isObject(node) || !node) {
										// Backwards compatibility for Array fields when data has not been migrated
										return extendedFieldsObj?.[parent]?.isArray && !Array.isArray(node)
											? [node]
											: node;
									}

									return Object.entries(node).reduce((acc, entry) => {
										const fieldName = entry[0];
										const hits = entry[1];

										// TODO: inner hits query if necessary
										const fullPath = joinParent(parent, fieldName);

										acc[fieldName] = nestedFieldNames?.includes(fullPath)
											? {
													hits: {
														edges: hits.map((node) => ({
															node: Object.assign(
																{},
																node,
																resolveNested({
																	node,
																	nestedFieldNames,
																	parent: fullPath,
																}),
															),
														})),
														total: hits.length,
													},
											  }
											: isObject(hits) && hits
											? Object.assign(
													hits.constructor(),
													resolveNested({
														node: hits,
														nestedFieldNames,
														parent: fullPath,
													}),
											  )
											: resolveNested({
													node: hits,
													nestedFieldNames,
													parent: fullPath,
											  });

										return acc;
									}, {});
								};

								const source = x._source;

								const nested_nodes = resolveNested({
									node: source,
									nestedFieldNames,
								});

								const copied_to_nodes = resolveCopiedTo({ node: source });

								return {
									searchAfter: x.sort
										? x.sort.map((x) =>
												Number.isInteger(x) && !Number.isSafeInteger(x)
													? // TODO: figure out a way to inject ES_CONSTANTS in here from @arranger/middleware
													  // ? ES_CONSTANTS.ES_MAX_LONG //https://github.com/elastic/elasticsearch-js/issues/662
													  `-9223372036854775808` //https://github.com/elastic/elasticsearch-js/issues/662
													: x,
										  )
										: [],
									node: Object.assign(
										source, // we're not afraid of mutating source here!
										{ id: x._id },
										nested_nodes,
										copied_to_nodes,
									),
								};
							});
						})
						.then(resolve);
				}),
		),
	).then((chunks) => chunks.reduce((acc, chunk) => acc.concat(chunk), []));
};

export default ({ type, Parallel, getServerSideFilter }) =>
	async (
		obj,
		{ first = 10, offset = 0, filters, score, sort, searchAfter, trackTotalHits = true },
		context,
		info,
	) => {
		let fields = getFields(info);
		let nestedFieldNames = type.nested_fieldNames;

		const { esClient } = context;
		const { extendedFields } = type;

		/**
   * @todo: I left this chunk here for reference, in case someone actually understands what it actually is trying to do
    let query = filters;
    if (filters || score) {
      // TODO: something with score?
      query = buildQuery({
        nestedFieldNames,
        filters: compileFilter({
          clientSideFilter: filters,
          serverSideFilter: getServerSideFilter(context),
        }),
      });
    }
    */

		const query = buildQuery({
			nestedFieldNames,
			filters: compileFilter({
				clientSideFilter: filters || { op: 'and', content: [] },
				serverSideFilter: getServerSideFilter(context),
			}),
		});

		let body =
			(query && {
				query,
			}) ||
			{};

		if (sort && sort.length) {
			// TODO: add query here to sort based on result. https://www.elastic.co/guide/en/elasticsearch/guide/current/nested-sorting.html
			body.sort = sort.map(({ fieldName, missing, order, ...rest }) => {
				const nested_path = nestedFieldNames
					.filter((nestedFieldName) => fieldName.indexOf(nestedFieldName) === 0)
					.reduce(
						(deepestPath, path) => (deepestPath.length > path.length ? deepestPath : path),
						'',
					);

				return {
					[fieldName]: {
						missing: missing
							? missing === 'first'
								? '_first'
								: '_last'
							: order === 'asc'
							? '_first'
							: '_last',
						order,
						...rest,
						...(nested_path?.length ? { nested: { path: nested_path } } : {}),
					},
				};
			});
		}

		if (searchAfter) {
			body.search_after = searchAfter;
		}

		const copyToSourceFields = findCopyToSourceFields(type.mapping);

		let { hits } = await esSearch(esClient)({
			index: type.index,
			size: first,
			from: offset,
			track_total_hits: trackTotalHits,
			_source: [
				...((fields.edges && Object.keys(fields.edges.node || {})) || []),
				...Object.values(copyToSourceFields),
			],
			track_scores: !!score,
			body,
		});

		return {
			edges: () =>
				hitsToEdges({
					copyToSourceFields,
					extendedFields,
					hits,
					nestedFieldNames,
					Parallel,
				}),
			total: () => hits.total.value,
		};
	};
