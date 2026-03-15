import getFields from 'graphql-fields';
import { JSONPath } from 'jsonpath-plus';
import {
	chunk,
	isObject,
	flattenDeep
} from 'lodash-es';

// import { ENV_CONFIG } from '#config/index.js';
import { buildQuery, isESValueSafeJSInt } from '#middleware/index.js';

import compileFilter from './utils/compileFilter.js';
import esSearch from './utils/esSearch.js';

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

const processChunk = ({ copyToSourceFields, extendedFieldsObj, hits, nestedFieldNames }) => {
	const resolveCopiedTo = ({ node }) => {
		const foundValues = Object.entries(copyToSourceFields).reduce((acc, pair) => {
			const copyToField = pair[0];
			const sourceField = pair[1];
			const found = {};

			found[copyToField] = flattenDeep(
				sourceField.map((path) =>
					JSONPath({
						json: node,
						path: path
							.split('.')
							.reduce(
								(acc, part, index) =>
									index === 0 ? `$.${part}` : `${acc}..${part}`,
								'',
							),
					})
				)
			);
			return found;
		}, {});
		return foundValues;
	};

	return hits.map((hit) => {
		const joinParent = (parent, fieldName) => (
			parent ? `${parent}.${fieldName}` : fieldName
		);

		const resolveNested = ({
			node,
			nestedFieldNames,
			parent = ''
		}) => {
			if (!isObject(node) || !node) {
				// Backwards compatibility for Array fields when data has not been migrated
				return extendedFieldsObj?.[parent]?.isArray && !Array.isArray(node)
					? [node]
					: node;
			}

			return Object
				.entries(node)
				.reduce((acc, entry) => {
					const fieldName = entry[0];
					const hits = entry[1];

					// TODO: inner hits query if necessary
					const fullPath = joinParent(parent, fieldName);
					const areHitsNested = nestedFieldNames?.includes(fullPath);
					const hitsAreActuallyNested = areHitsNested &&
						Array.isArray(hits);

					acc[fieldName] = hitsAreActuallyNested
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

		const source = hit._source;

		const nested_nodes = resolveNested({
			node: source,
			nestedFieldNames,
		});

		const copied_to_nodes = resolveCopiedTo({ node: source });

		return {
			searchAfter: hit.sort
				? hit.sort.map(isESValueSafeJSInt)
				: [],
			node: Object.assign(
				source, // we're not afraid of mutating source here!
				{ id: hit._id },
				nested_nodes,
				copied_to_nodes,
			),
		};
	});
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
	const chunkSize = dataSize > 1000
		? dataSize / systemCores + (dataSize % systemCores)
		: dataSize;

	const chunks = chunk(hits.hits, chunkSize);

	const chunkPromises = chunks.map(
		(chunk) => {
			const params = {
				copyToSourceFields,
				extendedFieldsObj,
				hits: chunk,
				nestedFieldNames,
			};

			//Parallel.spawn output has a .then but it's not returning an actual promise
			return new Promise((resolve, reject) => {
				if (chunkSize >= dataSize) {
					try {
						const results = processChunk(params);
						return resolve(results);
					} catch (err) {
						return reject(err);
					}
				}

				new Parallel(params)
					.require(flattenDeep, isObject, JSONPath)
					.spawn(processChunk)
					.then(resolve, (err) => {
						reject(err);
					});
			});
		});

	return Promise.all(chunkPromises)
		.then((chunks) => {
			return chunks.reduce((acc, chunk) =>
				acc.concat(chunk), []
			);
		})
		.catch((err) =>
			console.log("err", err)
		);
};

export default ({ type, Parallel, getServerSideFilter }) =>
	async (obj, { first = 10, offset = 0, filters, score, sort, searchAfter, trackTotalHits = true }, context, info) => {
		const fields = getFields(info);
		const nestedFieldNames = type.nested_fieldNames;

		const { esClient } = context;
		const { extendedFields } = type;

		const query = buildQuery({
			caller: 'resolveHits',
			nestedFieldNames,
			filters: compileFilter({
				clientSideFilter: filters || { op: 'and', content: [] },
				serverSideFilter: getServerSideFilter(context),
			}),
		});

		const body =
			(query && {
				query,
			}) ||
			{};

		if (sort && sort.length) {
			// TODO: add query here to sort based on result. https://www.elastic.co/guide/en/elasticsearch/guide/current/nested-sorting.html
			body.sort = sort.map(({ fieldName, missing, order, ...rest }) => {
				const nested_path = nestedFieldNames
					.filter((nestedFieldName) => fieldName.indexOf(nestedFieldName) === 0)
					.reduce((deepestPath, path) => (deepestPath.length > path.length ? deepestPath : path), '');

				return {
					[fieldName]: {
						missing: missing ? (missing === 'first' ? '_first' : '_last') : order === 'asc' ? '_first' : '_last',
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

		const { hits } = await esSearch(esClient)({
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
