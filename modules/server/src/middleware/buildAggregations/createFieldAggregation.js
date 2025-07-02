import { get, isEmpty } from 'lodash-es';

import { opSwitch } from '#middleware/buildQuery/index.js';
import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import { STATS, HISTOGRAM, BUCKETS, BUCKET_COUNT, CARDINALITY, TOPHITS, RANGE } from '#middleware/constants.js';

const MAX_AGGREGATION_SIZE = 300000;
const HISTOGRAM_INTERVAL_DEFAULT = 1000;
const CARDINALITY_DEFAULT_PRECISION_THRESHOLD = 40000; // max precision for ES6-7
const RANGES_DEFAULT = [{ from: 0 }];

const createNumericAggregation = ({ type, field, graphqlField }) => {
	const args = get(graphqlField, [type, '__arguments', 0]) || {};
	const options =
		type === HISTOGRAM
			? {
					interval: get(args, 'interval.value') || HISTOGRAM_INTERVAL_DEFAULT,
				}
			: type === RANGE
				? {
						ranges: get(args, 'ranges.value') || RANGES_DEFAULT,
					}
				: {};

	return {
		[`${field}:${type}`]: {
			[type]: {
				field,
				...options,
			},
		},
	};
};

const createTermAggregation = ({ field, isNested, graphqlField, termFilters }) => {
	const maxAggregations = get(graphqlField, ['buckets', '__arguments', 0, 'max', 'value'], MAX_AGGREGATION_SIZE);
	const termFilter = graphqlField?.buckets?.filter_by_term || null;
	const topHits = graphqlField?.buckets?.top_hits || null;
	const source = topHits?.__arguments?.[0]?._source || null;
	const size = topHits?.__arguments?.[1]?.size || 1;

	let innerAggs = {};
	if (isNested) {
		innerAggs = { ...innerAggs, rn: { reverse_nested: {} } };
	}
	if (topHits) {
		innerAggs = {
			...innerAggs,
			[`${field}.hits`]: {
				top_hits: {
					_source: source?.value || [],
					size: size?.value,
				},
			},
		};
	}

	if (termFilter) {
		const terms = termFilter.__arguments?.[0]?.filter?.value || [];

		const aggsFilters = terms?.content?.map((sqonFilter) =>
			opSwitch({
				nestedFields: [],
				filter: normalizeFilters(sqonFilter),
			}),
		);

		innerAggs = {
			...innerAggs,
			...(terms
				? {
						term_filters: {
							filter: {
								bool: {
									must: aggsFilters,
								},
							},
						},
					}
				: {}),
		};
	}

	const aggs = {
		[field]: {
			...(!isEmpty(innerAggs) ? { aggs: { ...innerAggs } } : {}),
			terms: { field, size: maxAggregations },
		},
		[`${field}:missing`]: {
			...(isNested ? { aggs: { rn: { reverse_nested: {} } } } : {}),
			missing: { field },
		},
	};

	return isNested && termFilters.length > 0
		? {
				[`${field}:nested_filtered`]: {
					filter: {
						bool: {
							must: termFilters,
						},
					},
					aggs: aggs,
				},
			}
		: aggs;
};

const getPrecisionThreshold = (graphqlField) => {
	const args = get(graphqlField, [CARDINALITY, '__arguments', 0], {});
	return args?.precision_threshold?.value || CARDINALITY_DEFAULT_PRECISION_THRESHOLD;
};

const computeCardinalityAggregation = ({ field, graphqlField }) => ({
	[`${field}:${CARDINALITY}`]: {
		cardinality: {
			field,
			precision_threshold: getPrecisionThreshold(graphqlField),
		},
	},
});

/**
 * graphqlFields: output from `graphql-fields` (https://github.com/robrichard/graphql-fields)
 * fieldName renamed to field, as that's the property name in ES
 */
export default ({ fieldName: field, graphqlField = {}, isNested = false, termFilters = [] }) => {
	const types = [BUCKETS, STATS, HISTOGRAM, BUCKET_COUNT, CARDINALITY, TOPHITS].filter((t) => graphqlField[t]);

	return types.reduce((acc, type) => {
		if (type === BUCKETS || type === BUCKET_COUNT) {
			return Object.assign(acc, createTermAggregation({ field, isNested, graphqlField, termFilters }));
		} else if ([STATS, HISTOGRAM].includes(type)) {
			return Object.assign(acc, createNumericAggregation({ type, field, graphqlField }));
		} else if (type === CARDINALITY) {
			return Object.assign(acc, computeCardinalityAggregation({ type, field, graphqlField }));
		} else {
			return acc;
		}
	}, {});
};
