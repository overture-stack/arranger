import React from 'react';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import AdvancedFacetView from './';
import { isEqual } from 'lodash';
import defaultApi from '../utils/api';

const fetchGraphqlQuery = async ({
  query,
  projectId,
  variables = null,
  api = defaultApi,
}) =>
  api({
    endpoint: `/${projectId}/graphql`,
    body: {
      query: query,
      variables,
    },
  }).then(data => data.data);

const fetchMappingData = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.index} {
        mapping,
        extended,
        aggsState {
          state {
            field, active
          }
        }
      }
    }`,
    ...fetchConfig,
  }).then(data => data[fetchConfig.index]);

const fetchAggregationData = async ({
  sqon,
  extended,
  projectId,
  index,
  api,
}) => {
  const fetchConfig = { projectId, index, api };
  const serializeToGraphQl = aggName => aggName.split('.').join('__');
  const serializeToPath = aggName => aggName.split('__').join('.');
  const allAggsNames = extended
    .map(entry => entry.field)
    .map(serializeToGraphQl);
  const getAggregationQuery = () =>
    allAggsNames
      .map(aggName => {
        const aggType = extended.find(
          entry => serializeToGraphQl(entry.field) === aggName,
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
  }).then(data => ({
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
      const currentField = `${parentField ? `${parentField}.` : ''}${key}`;
      const isId = fieldTypesToExclude.some(
        type => type === extended.find(ex => ex.field === currentField)?.type,
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
                      parentField: currentField,
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
      aggsState: {},
      aggregations: null,
      sqon: sqon || null,
    };
    this.blackListedAggTypes = ['object', 'nested'].concat(fieldTypesToExclude);
  }

  filterExtendedForFetchingAggs = ({ extended, aggsState }) =>
    extended.filter(
      e =>
        !this.blackListedAggTypes.includes(e.type) &&
        aggsState.state.find(s => s.field.split('__').join('.') === e.field)
          ?.active,
    );

  componentDidMount() {
    const { projectId, index, api } = this.props;
    const { sqon } = this.state;
    const fetchConfig = { projectId, index, sqon, api };
    fetchMappingData(fetchConfig).then(({ extended, mapping, aggsState }) =>
      fetchAggregationData({
        extended: this.filterExtendedForFetchingAggs({ extended, aggsState }),
        ...fetchConfig,
      }).then(({ aggregations }) => {
        const { fieldTypesToExclude = defaultFieldTypesToExclude } = this.props;
        this.setState({
          mapping: removeFieldTypesFromMapping({
            mapping,
            extended,
            fieldTypesToExclude,
          }),
          aggsState,
          extended,
          aggregations,
        });
      }),
    );
  }
  componentWillReceiveProps({ sqon }) {
    if (!isEqual(sqon, this.state.sqon)) {
      this.setState({ sqon });
    }
  }
  onSqonFieldChange = ({ sqon }) => {
    const { onSqonChange = () => {} } = this.props;
    const { aggsState } = this.state;
    fetchAggregationData({
      ...this.props,
      extended: this.filterExtendedForFetchingAggs({
        extended: this.state.extended,
        aggsState,
      }),
      sqon,
    }).then(({ aggregations }) =>
      this.setState({ sqon, aggregations }, () => onSqonChange({ sqon })),
    );
  };
  render() {
    const {
      fieldTypesToExclude = defaultFieldTypesToExclude,
      ...props
    } = this.props;
    return (
      <AdvancedFacetView
        {...props}
        rootTypeName={props.graphqlField}
        elasticMapping={this.state.mapping}
        extendedMapping={this.state.extended.filter(
          ex => !fieldTypesToExclude.some(type => ex.type === type),
        )}
        aggregations={this.state.aggregations}
        onSqonFieldChange={this.onSqonFieldChange}
        sqon={this.state.sqon}
      />
    );
  }
}
