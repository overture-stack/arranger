import React from 'react';
import { storiesOf } from '@storybook/react';
import { omit } from 'lodash';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import AdvancedFacetView from './';
import { isEqual } from 'lodash';

const fetchGraphqlQuery = async ({ query, API_HOST, PROJECT_ID, ES_HOST }) =>
  fetch(`${API_HOST}/${PROJECT_ID}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ES_HOST: ES_HOST,
    },
    body: JSON.stringify({
      query: query,
    }),
  })
    .then(res => res.json())
    .then(data => data.data);

const fetchMapping = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.ES_INDEX} {
        mapping,
      }
    }`,
    ...fetchConfig,
  }).then(data => data[fetchConfig.ES_INDEX]);

const fetchExtendedMapping = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.ES_INDEX} {
        extended,
      }
    }`,
    ...fetchConfig,
  }).then(data => data[fetchConfig.ES_INDEX]);

const fetchAggregationDataFromExtendedMapping = async ({
  extended,
  PROJECT_ID,
  ES_INDEX,
  API_HOST,
  ES_HOST,
}) => {
  const fetchConfig = { PROJECT_ID, ES_INDEX, API_HOST, ES_HOST };
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
      ${ES_INDEX} {
        aggregations { ${getAggregationQuery()} }
      }
    }`;
  return fetchGraphqlQuery({
    query,
    ...fetchConfig,
  }).then(data => ({
    aggregations: Object.keys(data[ES_INDEX].aggregations).reduce(
      (agg, key) => ({
        ...agg,
        [serializeToPath(key)]: data[ES_INDEX].aggregations[key],
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
      sqon: sqon || null,
    };
  }
  componentDidMount() {
    const { PROJECT_ID, ES_INDEX, API_HOST, ES_HOST } = this.props;
    const fetchConfig = { PROJECT_ID, ES_INDEX, API_HOST, ES_HOST };
    Promise.all([
      fetchMapping(fetchConfig),
      fetchExtendedMapping(fetchConfig),
    ]).then(([{ mapping }, { extended }]) =>
      fetchAggregationDataFromExtendedMapping({
        extended,
        ...fetchConfig,
      }).then(({ aggregations }) =>
        this.setState({ mapping, extended, aggregations }),
      ),
    );
  }
  componentWillReceiveProps({ sqon }) {
    if (!isEqual(sqon, this.state.sqon)) {
      this.setState({ sqon });
    }
  }
  onSqonFieldChange = ({ sqon }) => {
    const { onSqonChange = () => {} } = this.props;
    this.setState({ sqon }, () => onSqonChange({ sqon }));
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
