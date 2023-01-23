import React from 'react';
import { capitalize } from 'lodash';
import Query from '../Query';
import defaultApiFetcher from '../utils/api';
import { queryFromAgg } from './AggsState';

export default ({
	index = '',
	aggs = [],
	sqon = null,
	apiFetcher = defaultApiFetcher,
	...props
}) => {
	return index && aggs.length ? (
		<Query
			endpointTag={`${capitalize(index)}AggregationsQuery`}
			query={`
				query ${capitalize(index)}AggregationsQuery(
					$fieldNames: [String]
					$sqon: JSON
				) {
					${index} {
						aggregations (
							aggregations_filter_themselves: false
							filters: $sqon
						){
							${aggs.map((x) => x.query || queryFromAgg(x))}
						}

						configs {
							extended(fieldNames: $fieldNames)
						}
					}
				}
			`}
			renderError
			variables={{
				fieldNames: aggs.map((x) => x?.fieldName?.replace?.(/__/g, '.')),
				sqon,
			}}
			{...{ apiFetcher, ...props }}
		/>
	) : (
		''
	);
};
