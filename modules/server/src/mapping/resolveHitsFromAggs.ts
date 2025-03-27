import { get } from 'lodash';

import { type Resolver, type Root } from '#gqlServer.js';
import { applyAggregationMasking } from './masking.js';
import { type AggregationsResolver } from './resolveAggregations.js';

export enum Missing {
	first,
	last,
}

export enum Mode {
	avg,
	max,
	min,
	sum,
}

export enum Order {
	asc,
	desc,
}

type Sort = {
	fieldName: string;
	order: Order;
	mode: Mode;
	missing: Missing;
};

type HitsQuery = {
	score: string;
	offset: number;
	sort: [Sort];
	filters: JSON;
	before: string;
	after: string;
	first: number;
	last: number;
	searchAfter: JSON;
	trackTotalHits: boolean;
};

type HitsResolver = Resolver<Root, HitsQuery, Promise<{ total: number }>>;

/**
 * Resolver for "aggregation only mode" of Arranger where "hits" is based on "aggregations"
 * Calculate hits from aggregation data, instead of using "hits" ES response field
 *
 * If "aggregations" field is not in query, return 0
 *
 * @param aggregationsResolver - resolver ES query code for aggregations
 * @returns Returns a total count that is less than or equal to the actual total hits in the query.
 */
export const getHitsFromAggsResolver = (aggregationsResolver: AggregationsResolver) => {
	const resolver: HitsResolver = async (obj, args, context, info) => {
		/*
		 * Get "aggregations" field from full query if found
		 * Popular gql parsing libs parse the "info" property which may not include full query based on schema
		 */
		const aggregationsPath = 'operation.selectionSet.selections[0].selectionSet.selections';
		const aggregationsSelectionSet = get(info, aggregationsPath, []).find(
			(selection) => selection.kind === 'Field' && selection.name.value === 'aggregations',
		);

		if (aggregationsSelectionSet) {
			const modifiedInfo = { ...info, fieldNodes: [aggregationsSelectionSet] };

			const aggregations = await aggregationsResolver(
				obj,
				// @ts-ignore
				// modifying the query info field inline so it can query aggregations correctly
				// not idiomatic so doesn't line up with typings from graphql
				info.variableValues,
				context,
				modifiedInfo,
			);
			const { hitsTotal: total } = applyAggregationMasking({
				aggregations,
			});
			return { total };
		} else {
			return { total: 0 };
		}
	};
	return resolver;
};
