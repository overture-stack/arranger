import React from 'react';
import { storiesOf } from '@storybook/react';
import { themeDecorator } from './decorators';
import AdvancedFacetView from '../src/AdvancedFacetView';
import elasticMockMapping from '../src/AdvancedFacetView/elasticMockMapping';

const PROJECT_ID = 'testing5';
const ES_INDEX = 'models';
const API_HOST = 'http://localhost:5050';
const ES_HOST = 'http://142.1.177.54:9200';

const fetchGraphqlQuery = async query =>
  fetch(`${API_HOST}/${PROJECT_ID}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ES_HOST: ES_HOST, // TODO; get from somewhere
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

const fetchAggsState = () =>
  fetchGraphqlQuery(`{
    aggsState(indices: ["${ES_INDEX}"]) {
      states {
        state {
          field
          type
          active
        }
      }
    }
  }`);

const fetchAggregation = () =>
  fetchMapping().then(({ mapping }) => {
    return Promise.resolve(
      Object.keys(mapping).reduce(
        (agg, key) => ({
          ...agg,
          [key]: {
            buckets: [
              { key: 'male', doc_count: 200 },
              { key: 'female', doc_count: 300 },
            ],
          },
        }),
        {},
      ),
    );
  });

window.fetchAggregationData = async () => {
  Promise.all([fetchMapping(), fetchExtendedMapping(), fetchAggsState()]).then(
    ([{ mapping }, { extended }, { aggsState }]) => {
      console.log([mapping, extended, aggsState]);
      const aggs = aggsState[0].states[0].state;
      console.log(latestState);
    },
  );
};

class AdvancedFacetViewLiveStory extends React.Component {
  state = {
    mapping: {},
    extended: {},
  };
  componentDidMount() {
    Promise.all([
      fetchMapping(),
      fetchExtendedMapping(),
      fetchAggregation(),
    ]).then(([{ mapping }, { extended }, aggregations]) =>
      this.setState({ mapping, extended, aggregations }),
    );
  }
  render() {
    return (
      <AdvancedFacetView
        elasticMapping={this.state.mapping}
        extendedMapping={this.state.extended}
        aggregations={this.state.aggregations}
      />
    );
  }
}

storiesOf('AdvancedFacetView', module)
  .addDecorator(themeDecorator)
  .add('AdvancedFacetViewLive', () => <AdvancedFacetViewLiveStory />)
  .add('AdvancedFacetView', () => (
    <AdvancedFacetView elasticMapping={elasticMockMapping} />
  ));
