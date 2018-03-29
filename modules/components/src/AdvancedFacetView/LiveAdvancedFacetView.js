import React from 'react';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import AdvancedFacetView from './';
import { isEqual } from 'lodash';
import apiFetch from '../utils/api';

const fetchGraphqlQuery = async ({ query, projectId, variables = null }) =>
  apiFetch({
    endpoint: `/${projectId}/graphql`,
    body: {
      query: query,
      variables,
    },
  }).then(data => data.data);

const fetchData = async fetchConfig =>
  fetchGraphqlQuery({
    ...fetchConfig,
    query: `
      {
        ${fetchConfig.index} {
          mapping
          extended
          aggsState {
            state {
              field
              active
            }
          }
        }
      }
    `,
  }).then(data => data[fetchConfig.index]);

const fetchAggregationData = async ({ sqon, extended, projectId, index }) => {
  const fetchConfig = { projectId, index };
  const serializeToGraphQl = aggName => aggName.split('.').join('__');
  const serializeToPath = aggName => aggName.split('__').join('.');

  const allAggsNames = extended.map(entry => serializeToGraphQl(entry.field));

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
}) => {
  return Object.entries(mapping).reduce((acc, [key, val]) => {
    const currentField = `${parentField ? `${parentField}.` : ''}${key}`;
    const keepField = extended.find(ex => ex.field === currentField);
    const toSpread = keepField
      ? {
          ...(val.properties
            ? {
                [key]: {
                  ...val,
                  properties: removeFieldTypesFromMapping({
                    mapping: val.properties,
                    extended,
                    parentField: currentField,
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
  }, {});
};

const defaultFieldTypesToExclude = ['id', 'text'];
export default class LiveAdvancedFacetView extends React.Component {
  state = {
    mapping: {},
    extended: [],
    aggregations: null,
  };

  componentDidMount() {
    fetchData(this.props).then(({ mapping, extended, aggsState }) => {
      const filteredExtended = extended.filter(e => {
        const state = aggsState.state.find(s => s.field === e.field);
        return state && state.active;
      });

      this.setState({
        extended: filteredExtended,
        mapping: removeFieldTypesFromMapping({
          mapping,
          extended: filteredExtended,
        }),
      });

      return fetchAggregationData({
        extended: filteredExtended,
        ...this.props,
      }).then(({ aggregations }) => {
        this.setState({ aggregations });
      });
    });
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(nextProps.sqon, this.props.sqon)) {
      fetchAggregationData({
        ...nextProps,
        extended: this.state.extended,
      }).then(({ aggregations }) => this.setState({ aggregations }));
    }
  }

  render() {
    return (
      <AdvancedFacetView
        elasticMapping={this.state.mapping}
        extendedMapping={this.state.extended}
        aggregations={this.state.aggregations}
        statComponent={this.props.statComponent}
        onSqonFieldChange={this.props.onSqonChange}
        sqon={this.props.sqon}
      />
    );
  }
}
