import React from 'react';
import { omit } from 'lodash';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import AdvancedFacetView from './';
import { isEqual } from 'lodash';
import stringifyObject from 'stringify-object';
import apiFetch from '../utils/api';

const fetchGraphqlQuery = async ({ query, projectId }) =>
  apiFetch({
    endpoint: `/${projectId}/graphql`,
    body: {
      query: query,
    },
  }).then(data => data.data);

const fetchMapping = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.index} {
        mapping,
      }
    }`,
    ...fetchConfig,
  }).then(data => data[fetchConfig.index]);

const fetchExtendedMapping = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.index} {
        extended,
      }
    }`,
    ...fetchConfig,
  }).then(data => data[fetchConfig.index]);

const fetchAggregationData = async ({ sqon, extended, projectId, index }) => {
  const fetchConfig = { projectId, index };
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
                ? `buckets { key doc_count }`
                : `stats { max min avg sum }`
            }
          }`;
      })
      .join('');
  const query = `
    {
      ${index} {
        aggregations (aggregations_filter_themselves: false ${
          sqon
            ? `filters: ${stringifyObject(sqon, { singleQuotes: false })}`
            : ''
        }) { ${getAggregationQuery()} }
      }
    }`;
  return fetchGraphqlQuery({
    query,
    ...fetchConfig,
  }).then(data => ({
    aggregations: Object.keys(data[index].aggregations).reduce(
      (agg, key) => ({
        ...agg,
        [serializeToPath(key)]: data[index].aggregations[key],
      }),
      {},
    ),
  }));
};

export default class LiveAdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    const { sqon } = props;
    this.state = {
      mapping: {},
      extended: {},
      aggregations: null,
      sqon: sqon || null,
    };
  }
  componentDidMount() {
    const { projectId, index } = this.props;
    const fetchConfig = { projectId, index };
    Promise.all([
      fetchMapping(fetchConfig),
      fetchExtendedMapping(fetchConfig),
    ]).then(([{ mapping }, { extended }]) =>
      fetchAggregationData({
        extended: extended.filter(
          e => e.type !== 'object' && e.type !== 'nested',
        ),
        ...fetchConfig,
      }).then(({ aggregations }) =>
        this.setState({
          mapping,
          extended,
          aggregations,
        }),
      ),
    );
  }
  componentWillReceiveProps({ sqon }) {
    if (!isEqual(sqon, this.state.sqon)) {
      this.setState({ sqon });
    }
  }
  onSqonFieldChange = ({ sqon }) => {
    const { onSqonChange = () => {}, projectId, index } = this.props;
    fetchAggregationData({
      ...this.props,
      extended: this.state.extended.filter(
        e => e.type !== 'object' && e.type !== 'nested',
      ),
      sqon,
    }).then(({ aggregations }) =>
      this.setState({ sqon, aggregations }, () => onSqonChange({ sqon })),
    );
  };
  render() {
    return (
      <AdvancedFacetView
        elasticMapping={this.state.mapping}
        extendedMapping={this.state.extended}
        aggregations={this.state.aggregations}
        onSqonFieldChange={this.onSqonFieldChange}
        sqon={this.state.sqon}
      />
    );
  }
}
