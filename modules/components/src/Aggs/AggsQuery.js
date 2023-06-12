import { capitalize } from 'lodash';

import Query from '@/Query';
import defaultApiFetcher from '@/utils/api';
import { DEBUG } from '@/utils/config';

import { queryFromAgg } from './AggsState';

const AggsQuery = ({
	index: documentType = '',
	aggs = [],
	sqon = null,
	apiFetcher = defaultApiFetcher,
	...props
}) => {
	// TODO: rename "index" to document type... removing index from Front end stuff

	return documentType && aggs.length ? (
		<Query
			endpointTag={`Arranger-${capitalize(documentType)}Aggregations`}
			query={`
				query ${capitalize(documentType)}AggregationsQuery(
					$sqon: JSON
				) {
					${documentType} {
						aggregations (
							aggregations_filter_themselves: false
							filters: $sqon
						){
							${aggs.map((x) => x.query || queryFromAgg(x))}
						}
					}
				}
			`}
			renderError={DEBUG}
			variables={{
				sqon,
			}}
			{...{ apiFetcher, ...props }}
		/>
	) : (
		''
	);
};

export default AggsQuery;
