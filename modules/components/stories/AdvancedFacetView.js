import React from 'react';
import { storiesOf } from '@storybook/react';
import { themeDecorator } from './decorators';
import AdvancedFacetView from '../src/AdvancedFacetView';
import elasticMockMapping from '../src/AdvancedFacetView/elasticMockMapping';

const PROJECT_ID = 'testing5';
const ES_INDEX = 'models';
const API_HOST = 'http://localhost:5050';
const ES_HOST = 'http://142.1.177.54:9200';

const fetchMapping = () =>
  fetch(`${API_HOST}/${PROJECT_ID}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ES_HOST: ES_HOST, // TODO; get from somewhere
    },
    body: JSON.stringify({
      query: `{
        ${ES_INDEX} {
          mapping,
          extended,
        }
      }`,
    }),
  })
    .then(r => r.json())
    .then(({ data }) => {
      return Promise.resolve(data[ES_INDEX]);
    });

window.fetchAggregation = () =>
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

class AdvancedFacetViewLiveStory extends React.Component {
  state = {
    mapping: {},
    extended: {},
  };
  componentDidMount() {
    Promise.all([fetchMapping(), fetchAggregation()]).then(
      ([{ extended, mapping }, aggregations]) =>
        this.setState({ extended, mapping, aggregations }),
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
