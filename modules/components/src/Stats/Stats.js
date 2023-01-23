import React, { Fragment } from 'react';
import Spinner from 'react-spinkit';
import { get } from 'lodash';

import Query from '../Query';
import { AggsState } from '../Aggs';
import formatNumber from '../utils/formatNumber';

export const underscoreField = (str) => (str || '').split('.').join('__');

export const accessor = ({ aggsField, dataAccessor }) =>
	`${underscoreField(aggsField?.fieldName)}.${
		dataAccessor || (aggsField?.isTerms ? `buckets.length` : `stats.count`)
	}`;

const constructQuery = ({ documentType, query, resolver = 'aggregations' }) => `
	query($sqon: JSON) {
		data: ${documentType} {
			${resolver} (
				filters: $sqon
				${resolver === 'aggregations' ? 'include_missing: false' : ''}
				${resolver === 'aggregations' ? 'aggregations_filter_themselves: true' : ''}
			) {
				${query}
			}
		}
	}
`;

const LoadingSpinner = () => (
	<Spinner
		fadeIn="none"
		name="circle"
		color="#a9adc0"
		style={{
			width: 15,
			height: 15,
			marginRight: 9,
		}}
	/>
);

const RootQuery = ({ documentType, render, sqon, ...props }) => (
	<Query
		{...props}
		endpointTag="StatsRootQuery"
		query={constructQuery({ documentType, resolver: 'hits', query: 'total' })}
		render={({ data, error, loading, value }) =>
			render({ loading, value: get(data, `data.hits.total`, '') })
		}
		renderError
		shouldFetch
		variables={{ sqon }}
	/>
);

const FieldQuery = ({
	aggsState: { aggs },
	fieldName,
	render,
	sqon,
	documentType,
	dataAccessor,
	formatResult = (x) => x,
	aggsField = aggs.find((x) => x.fieldName === underscoreField(fieldName)),
	...props
}) => (
	<Query
		{...props}
		endpointTag="StatsFieldQuery"
		query={constructQuery({ documentType, query: aggsField?.query })}
		render={({ data, loading }) =>
			render({
				loading,
				value: formatResult(
					get(data, `data.aggregations.${accessor({ aggsField, dataAccessor })}`, ''),
				),
			})
		}
		renderError
		shouldFetch={aggs.length}
		variables={{ sqon }}
	/>
);

const Stat = ({
	icon = '',
	label = '',
	isRoot = false,
	LoadingSpinnerComponent,
	QueryComponent = isRoot ? RootQuery : FieldQuery,
	...props
}) => {
	return (
		<div className="stat-container">
			{icon}
			<div className="stat-content">
				<QueryComponent
					{...props}
					render={(x) => (x.loading ? <LoadingSpinnerComponent /> : formatNumber(x.value))}
				/>
			</div>
			<div className="stat-label">{label}</div>
		</div>
	);
};

const Stats = ({
	apiFetcher,
	documentType,
	stats,
	className,
	render,
	small,
	transparent,
	LoadingSpinnerComponent = LoadingSpinner,
	...props
}) => (
	<div
		className={`
			stats-container
			${small ? `small` : ``}
			${transparent ? `transparent` : ``}
		`}
		css={`
			display: flex;
			align-items: center;
			${className};
		`}
	>
		<AggsState
			{...{ apiFetcher, documentType }}
			render={(aggsState) =>
				stats.map((stat, i) => (
					<Fragment key={stat.label}>
						{i > 0 && <div key={i} className="stats-line" />}
						<Stat
							{...{
								aggsState,
								apiFetcher,
								documentType,
								LoadingSpinnerComponent,
							}}
							{...props}
							{...stat}
						/>
					</Fragment>
				))
			}
		/>
	</div>
);

export default Stats;
