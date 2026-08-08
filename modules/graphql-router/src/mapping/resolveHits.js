import { configOptionalProperties, tableDefaults } from '@overture-stack/arranger-types/configs/constants';
import getFields from 'graphql-fields';
import { JSONPath } from 'jsonpath-plus';
import { chunk, isObject, flattenDeep } from 'lodash-es';

// import { ENV_CONFIG } from '#config/index.js';
import { buildQuery, isESValueSafeJSInt } from '#middleware/index.js';
import { applyNestingPrefix, applyNestingPrefixToFieldNames, unwrapHits } from '#middleware/utils/nestingPrefix.js';

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

const processChunk = ({ copyToSourceFields, extendedFieldsObj, graphqlNameByPath = {}, hits, nestedFieldNames }) => {
	const warnings = [];

	const resolveCopiedTo = ({ node }) => {
		const foundValues = Object.entries(copyToSourceFields).reduce((acc, pair) => {
			const copyToField = pair[0];
			const sourceField = pair[1];
			const found = {};

			found[graphqlNameByPath[copyToField] ?? copyToField] = flattenDeep(
				sourceField.map((path) =>
					JSONPath({
						json: node,
						path: path
							.split('.')
							.reduce((acc, part, index) => (index === 0 ? `$.${part}` : `${acc}..${part}`), ''),
					}),
				),
			);
			return found;
		}, {});
		return foundValues;
	};

	const results = hits.map((hit) => {
		const joinParent = (parent, fieldName) => (parent ? `${parent}.${fieldName}` : fieldName);

		const resolveNested = ({ node, nestedFieldNames, parent = '' }) => {
			if (!isObject(node) || !node) {
				// Backwards compatibility for Array fields when data has not been migrated
				return extendedFieldsObj?.[parent]?.isArray && !Array.isArray(node) ? [node] : node;
			}

			return Object.entries(node).reduce((acc, entry) => {
				const fieldName = entry[0];
				const hits = entry[1];

				// TODO: inner hits query if necessary
				const fullPath = joinParent(parent, fieldName);
				const areHitsNested = nestedFieldNames?.includes(fullPath);
				const hitsAreActuallyNested = areHitsNested && Array.isArray(hits);
				const graphqlName = graphqlNameByPath[fullPath] ?? fieldName;

				// ES never enforces a field's cardinality against its mapping: any keyword/text/etc.
				// field can hold an array of values on a given document regardless of whether
				// extended.json declares `isArray`. Without `isArray`, the schema types the field as
				// a plain scalar, and `Object.assign(hits.constructor(), ...)` below would otherwise
				// round-trip an array of primitives unchanged (lodash's `isObject` treats arrays as
				// objects too), letting it reach GraphQL's own scalar serializer, which throws
				// ("String cannot represent value: [...]") and nulls the whole hit. Coercing to the
				// first value here keeps the response usable; the dropped values are recorded so
				// they aren't just silently lost.
				if (
					Array.isArray(hits) &&
					hits.length > 0 &&
					!hitsAreActuallyNested &&
					!extendedFieldsObj?.[fullPath]?.isArray
				) {
					if (hits.length > 1) {
						warnings.push({
							field: graphqlName,
							message: `Field "${fullPath}" holds ${hits.length} values but is not configured with isArray; only the first value ("${hits[0]}") is shown.`,
						});
					}
					acc[graphqlName] = hits[0];
					return acc;
				}

				// The GraphQL schema may expose this field under a sanitized name (see
				// mapping/utils/graphqlNameRegistry.ts); the raw key stays on `source` too (harmless,
				// since nothing in the schema ever asks for it), this just also adds the one resolvers
				// actually look up.
				acc[graphqlName] = hitsAreActuallyNested
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
			searchAfter: hit.sort ? hit.sort.map(isESValueSafeJSInt) : [],
			node: Object.assign(
				source, // we're not afraid of mutating source here!
				{ id: hit._id },
				nested_nodes,
				copied_to_nodes,
			),
		};
	});

	return { results, warnings };
};

export const hitsToEdges = ({
	copyToSourceFields = {},
	extendedFields = [],
	graphqlNameByPath = {},
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
	const dataSize = hits?.hits?.length || 0;
	const chunkSize = dataSize > 1000 ? dataSize / systemCores + (dataSize % systemCores) : dataSize;

	const chunks = chunk(hits.hits, chunkSize);

	const chunkPromises = chunks.map((chunk) => {
		const params = {
			copyToSourceFields,
			extendedFieldsObj,
			graphqlNameByPath,
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
		.then((chunks) =>
			chunks.reduce(
				(acc, chunk) => ({
					results: acc.results.concat(chunk.results),
					warnings: acc.warnings.concat(chunk.warnings),
				}),
				{ results: [], warnings: [] },
			),
		)
		.catch((err) => console.log('err', err));
};

export const applyResultsWindow = (first, maxResultsWindow) =>
	Math.min(first, maxResultsWindow ?? tableDefaults.MAX_RESULTS_WINDOW);

export default ({ type, Parallel, getServerSideFilter }) =>
	async (
		obj,
		{ first = 10, offset = 0, filters, score, sort, searchAfter, trackTotalHits = true },
		context,
		info,
	) => {
		const fields = getFields(info);
		const nestedFieldNames = type.nested_fieldNames;
		const nestingPrefix = type.config?.[configOptionalProperties.NESTING_PREFIX];
		const esNestedFieldNames = applyNestingPrefixToFieldNames(nestedFieldNames, nestingPrefix) ?? nestedFieldNames;

		const { esClient } = context;
		const { extendedFields } = type;

		const query = buildQuery({
			caller: 'resolveHits',
			nestedFieldNames,
			nestingPrefix,
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
				const esFieldName = applyNestingPrefix(fieldName, nestingPrefix);
				const nested_path = esNestedFieldNames
					.filter((nestedFieldName) => esFieldName.indexOf(nestedFieldName) === 0)
					.reduce((deepestPath, path) => (deepestPath.length > path.length ? deepestPath : path), '');

				return {
					[esFieldName]: {
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

		// A per-field _source pattern list can't be prefixed field-by-field without risking a
		// mismatch against a GraphQL-sanitized name; requesting the whole envelope is a strict
		// superset of any narrower list, so it's the simple, always-correct choice here.
		const sourceFields = nestingPrefix
			? [nestingPrefix]
			: [...((fields.edges && Object.keys(fields.edges.node || {})) || []), ...Object.values(copyToSourceFields)];

		const searchResult = await esSearch(esClient)({
			index: type.index,
			size: applyResultsWindow(first, type.config?.table?.maxResultsWindow),
			from: offset,
			track_total_hits: trackTotalHits,
			_source: sourceFields,
			track_scores: !!score,
			body,
		});

		const hits = unwrapHits(searchResult?.body?.hits, nestingPrefix) || { hits: [], total: { value: 0 } };

		return {
			edges: () =>
				hitsToEdges({
					copyToSourceFields,
					extendedFields,
					graphqlNameByPath: type.graphqlNameRegistry?.leafNamesByPath,
					hits,
					nestedFieldNames,
					Parallel,
				}).then(({ results, warnings }) => {
					if (warnings.length) {
						// Kept on `context` (plain, server-agnostic) rather than any Apollo-specific
						// mechanism, so a later response-formatting layer (whichever GraphQL server is
						// in front of this resolver) can surface these to the caller; for now this at
						// least keeps them from being silently lost.
						context.warnings = [...(context.warnings || []), ...warnings];
						warnings.forEach((warning) => console.warn(`  WARNING: ${warning.message}`));
					}
					return results;
				}),
			total: () => hits.total.value,
		};
	};
