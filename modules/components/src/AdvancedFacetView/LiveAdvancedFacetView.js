import React from 'react';
import { storiesOf } from '@storybook/react';
import { omit } from 'lodash';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import AdvancedFacetView from './';
import { replaceSQON, toggleSQON } from '../SQONView/utils';

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
    .then(data => Promise.resolve(data.data));

const fetchMapping = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.ES_INDEX} {
        mapping,
      }
    }`,
    ...fetchConfig,
  }).then(data => {
    return Promise.resolve(data[fetchConfig.ES_INDEX]);
  });

const fetchExtendedMapping = async fetchConfig =>
  fetchGraphqlQuery({
    query: `{
      ${fetchConfig.ES_INDEX} {
        extended,
      }
    }`,
    ...fetchConfig,
  }).then(data => {
    return Promise.resolve(data[fetchConfig.ES_INDEX]);
  });

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
  }).then(data =>
    Promise.resolve({
      aggregations: Object.keys(data[ES_INDEX].aggregations).reduce(
        (agg, key) => ({
          ...agg,
          [serializeToPath(key)]: data[ES_INDEX].aggregations[key],
        }),
        {},
      ),
    }),
  );
};

export default class LiveAdvancedFacetView extends React.Component {
  constructor(props) {
    super(props);
    const { sqon } = props;
    this.state = {
      mapping: {},
      extended: {},
      sqon: sqon || {
        op: 'and',
        content: [],
      },
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
  componentWillReceiveProps({ sqon = this.state.sqon }) {
    this.setState({ sqon });
  }
  onSqonFieldChange = ({ value, path, esType, aggType, sqon }) => {
    const { onSqonChange = () => {} } = this.props;
    if (sqon) {
      this.setState({ sqon });
    } else {
      const newSQON = (() => {
        switch (aggType) {
          case 'Aggregations':
            return toggleSQON(
              {
                op: 'and',
                content: [
                  {
                    op: 'in',
                    content: {
                      field: path,
                      value: value,
                    },
                  },
                ],
              },
              this.state.sqon,
            );
          case 'NumericAggregations':
            return replaceSQON(
              {
                op: 'and',
                content: [
                  { op: '>=', content: { field: path, value: value.min } },
                  { op: '<=', content: { field: path, value: value.max } },
                ],
              },
              this.state.sqon,
            );
          default:
            return this.state.sqon;
        }
      })();
      this.setState({ sqon: newSQON });
      onSqonChange({ newSQON });
    }
  };
  render() {
    const { sqon = {} } = this.props;
    return (
      <AdvancedFacetView
        elasticMapping={this.state.mapping}
        extendedMapping={this.state.extended}
        aggregations={this.state.aggregations}
        sqon={this.state.sqon}
        onSqonFieldChange={this.onSqonFieldChange}
      />
    );
  }
}
