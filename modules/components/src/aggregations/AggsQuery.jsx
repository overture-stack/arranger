import { capitalize } from 'lodash-es';

import Query from '#Query.js';
import defaultApiFetcher from '#utils/api.js';
import { DEBUG } from '#utils/config.js';

import { queryFromAgg } from './AggsState.js';

const AggsQuery = ({ documentType = '', aggs = [], sqon = null, apiFetcher = defaultApiFetcher, ...props }) => {
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
	) : null;
};

export default AggsQuery;
