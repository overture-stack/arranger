import React from 'react';
import { storiesOf } from '@storybook/react';
import { omit } from 'lodash';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import { themeDecorator } from './decorators';
import AdvancedFacetView from '../src/AdvancedFacetView';
import elasticMockMapping from '../src/AdvancedFacetView/elasticMockMapping';
import { inCurrentSQON, replaceSQON, toggleSQON } from '../src/SQONView/utils';

const PROJECT_ID = 'testing1'; // TODO: get from somewhere
const ES_INDEX = 'testing1'; // TODO: get from somewhere
const API_HOST = 'http://localhost:5050'; // TODO: get from somewhere
// const ES_HOST = 'http://142.1.177.54:9200';
const ES_HOST = 'http://localhost:9200'; // TODO: get from somewhere

const fetchGraphqlQuery = async query =>
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

const fetchMapping = async () =>
  fetchGraphqlQuery(`{
    ${ES_INDEX} {
      mapping,
    }
  }`).then(data => {
    return Promise.resolve(data[ES_INDEX]);
  });

const fetchExtendedMapping = async () =>
  fetchGraphqlQuery(`{
    ${ES_INDEX} {
      extended,
    }
  }`).then(data => {
    return Promise.resolve(data[ES_INDEX]);
  });

const fetchAggregationDataFromExtendedMapping = async extended => {
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
  console.log(query);
  return fetchGraphqlQuery(query).then(data =>
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

class LiveAdvancedFacetView extends React.Component {
  state = {
    mapping: {},
    extended: {},
    sqon: {
      op: 'and',
      content: [
        {
          op: 'in',
          content: {
            field: 'clinical_stage',
            value: ['stage_1', 'stage_2'],
          },
        },
      ],
    },
  };
  componentDidMount() {
    Promise.all([fetchMapping(), fetchExtendedMapping()]).then(
      ([{ mapping }, { extended }]) =>
        fetchAggregationDataFromExtendedMapping(extended).then(
          ({ aggregations }) =>
            this.setState({ mapping, extended, aggregations }),
        ),
    );
  }
  onSqonFieldChange = ({ value, path, esType, aggType }) => {
    const newSQON = toggleSQON(
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
    this.setState({ sqon: newSQON });
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

const injectMockBuckets = node =>
  Object.keys(node).reduce(
    (agg, key) => ({
      ...agg,
      [key]: attachBucketToNode(node[key]),
    }),
    {},
  );

const attachBucketToNode = mappingNode => ({
  ...mappingNode,
  ...(mappingNode.properties
    ? {
        properties: injectMockBuckets(mappingNode.properties),
      }
    : {
        bucket: [
          { key: 'male', doc_count: 200 },
          { key: 'female', doc_count: 300 },
        ],
      }),
});

const mockAggregations = (window.mockAggregations = injectMockBuckets(
  elasticMockMapping,
));

storiesOf('AdvancedFacetView', module)
  .addDecorator(themeDecorator)
  .add('AdvancedFacetViewLive', () => <LiveAdvancedFacetView />)
  .add('AdvancedFacetView', () => (
    <AdvancedFacetView
      elasticMapping={elasticMockMapping}
      aggregations={mockAggregations}
    />
  ));
