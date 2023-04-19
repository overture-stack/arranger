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
	// TODO: rename "index" to document type... removing index from Front end stuff

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
