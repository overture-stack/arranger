import React from 'react';
import { isEqual } from 'lodash';

import defaultApiFetcher from '@/utils/api';
import esToAggTypeMap from '@/utils/esToAggTypeMap';
import noopFn, { emptyObj } from '@/utils/noops';

import AdvancedFacetView from './';

const fetchGraphqlQuery = async ({ query, variables = null, apiFetcher = defaultApiFetcher }) =>
	apiFetcher({
		endpoint: `/graphql`,
		body: {
			query: query,
			variables,
		},
	}).then((data) => data.data);

// TODO: remove dependence on "mapping"
const fetchMappingData = async (fetchConfig) =>
	fetchGraphqlQuery({
		query: `{
      ${fetchConfig.index} {
        configs {
          extended,
          facets {
            aggregations {
				fieldName
				isActive,
            }
          }
        }
        mapping,
      }
    }`,
		...fetchConfig,
	}).then((data) => data[fetchConfig.index]);

const fetchAggregationData = async ({ sqon, extended, index, apiFetcher }) => {
	const fetchConfig = { index, apiFetcher };
	const serializeToGraphQl = (aggName) => aggName.split('.').join('__');
	const serializeToPath = (aggName) => aggName.split('__').join('.');
	const allAggsNames = extended.map((entry) => entry.fieldName).map(serializeToGraphQl);
	const getAggregationQuery = () =>
		allAggsNames
			.map((aggName) => {
				const aggType = extended.find(
					(entry) => serializeToGraphQl(entry.fieldName) === aggName,
				).type;
				return `
          ${aggName} {
            ${
							esToAggTypeMap[aggType] === 'Aggregations'
								? `buckets { key key_as_string doc_count }`
								: `stats { max min avg sum }`
						}
          }`;
			})
			.join('');
	const query = `
    query ($sqon: JSON){
      ${index} {
        aggregations (
          aggregations_filter_themselves: false
          filters: $sqon
        ) { ${getAggregationQuery()} }
      }
    }`;
	return fetchGraphqlQuery({
		query,
		variables: { sqon },
		...fetchConfig,
	}).then((data) => ({
		aggregations: Object.keys(data[index].aggregations || {}).reduce(
			(agg, key) => ({
				...agg,
				[serializeToPath(key)]: data[index].aggregations[key],
			}),
			{},
		),
	}));
};

const removeFieldTypesFromMapping = ({
	mapping,
	extended,
	parentField = null,
	fieldTypesToExclude = [],
}) => {
	const output = {
		...Object.entries(mapping).reduce((acc, [key, val]) => {
			const currentFieldName = `${parentField ? `${parentField}.` : ''}${key}`;
			const isId = fieldTypesToExclude.some(
				(type) => type === extended.find((ex) => ex.fieldName === currentFieldName)?.type,
			);
			const toSpread = !isId
				? {
						...(val.properties
							? {
									[key]: {
										...val,
										properties: removeFieldTypesFromMapping({
											mapping: val.properties,
											extended,
											parentField: currentFieldName,
											fieldTypesToExclude,
										}),
									},
							  }
							: {
									[key]: val,
							  }),
				  }
				: {};
			return {
				...acc,
				...toSpread,
			};
		}, {}),
	};
	return output;
};

const defaultFieldTypesToExclude = ['id', 'text'];

export default class LiveAdvancedFacetView extends React.Component {
	constructor(props) {
		super(props);
		const { sqon, fieldTypesToExclude = defaultFieldTypesToExclude } = props;
		this.state = {
			mapping: {},
			extended: [],
			facets: {},
			aggregations: null,
			sqon: sqon || null,
		};
		this.denyListedAggTypes = ['object', 'nested'].concat(fieldTypesToExclude);
	}

	filterExtendedForFetchingAggs = ({ extended, facets }) =>
		extended?.filter(
			(e) =>
				!this.denyListedAggTypes.includes(e.type) &&
				facets?.aggregations?.find((s) => s.fieldName.split('__').join('.') === e.fieldName)
					?.isActive,
		);

	componentDidMount() {
		const { index, apiFetcher } = this.props;
		const { sqon } = this.state;
		const fetchConfig = { index, sqon, apiFetcher };
		fetchMappingData(fetchConfig).then(({ configs: { extended, facets } = emptyObj, mapping }) => {
			return fetchAggregationData({
				extended: this.filterExtendedForFetchingAggs({ extended, facets }),
				...fetchConfig,
			}).then(({ aggregations }) => {
				const { fieldTypesToExclude = defaultFieldTypesToExclude } = this.props;

				this.setState({
					mapping: removeFieldTypesFromMapping({
						mapping,
						extended,
						fieldTypesToExclude,
					}),
					facets,
					extended,
					aggregations,
				});
			});
		});
	}

	UNSAFE_componentWillReceiveProps({ sqon }) {
		if (!isEqual(sqon, this.state.sqon)) {
			this.setState({ sqon });
		}
	}

	onSqonFieldChange = ({ sqon }) => {
		const { onSqonChange = noopFn } = this.props;
		const { extended, facets } = this.state;

		fetchAggregationData({
			...this.props,
			extended: this.filterExtendedForFetchingAggs({
				extended,
				facets,
			}),
			sqon,
		}).then(({ aggregations }) =>
			this.setState({ sqon, aggregations }, () => onSqonChange({ sqon })),
		);
	};

	render() {
		const { fieldTypesToExclude = defaultFieldTypesToExclude, ...props } = this.props;
		return (
			<AdvancedFacetView
				{...props}
				rootTypeName={props.documentType}
				elasticMapping={this.state.mapping}
				extendedMapping={this.state.extended.filter(
					(ex) => !fieldTypesToExclude.some((type) => ex.type === type),
				)}
				aggregations={this.state.aggregations}
				onSqonFieldChange={this.onSqonFieldChange}
				sqon={this.state.sqon}
			/>
		);
	}
}
