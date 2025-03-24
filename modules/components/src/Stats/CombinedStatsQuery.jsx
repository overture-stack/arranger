import { get } from 'lodash-es';

import { AggsState } from '#aggregations/index.js';
import Query from '#Query.js';

import { accessor, underscoreField } from './Stats.js';

const CombinedStatsQuery = ({ apiFetcher, documentType, sqon, stats, render }) => (
	<AggsState
		{...{ apiFetcher, documentType }}
		render={({ aggs }) => {
			const decoratedStats = stats.map((s, i) => ({
				key: `q${i}`,
				formatResult: (x) => x,
				aggsField: aggs.find((x) => x.field === underscoreField(s.field)),
				...s,
			}));
			return (
				<Query
					{...{ apiFetcher, documentType }}
					endpointTag="Arranger-CombinedStats"
					query={`
						query($sqon: JSON) {
							data: ${documentType} {
								${decoratedStats.map(
						({ key, aggsField, isRoot }) =>
							`${key}: ${isRoot
								? `hits(filters: $sqon) {
													total
												}`
								: `aggregations(filters: $sqon, aggregations_filter_themselves: true) {
													${aggsField?.query || ``}
												}`
							}`,
					)}
							}
						}
					`}
					render={({ data, loading }) =>
						render({
							loading,
							data: decoratedStats.reduce((acc, x) => {
								acc[x.label] = x.formatResult(get(data, `data.${x.key}.${x.isRoot ? `total` : accessor(x)}`, null));
								return acc;
							}, {}),
						})
					}
					renderError
					shouldFetch={aggs.length}
					variables={{ sqon }}
				/>
			);
		}}
	/>
);

export default CombinedStatsQuery;
