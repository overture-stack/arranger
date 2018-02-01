import React from 'react';
import { storiesOf } from '@storybook/react';
import { themeDecorator } from './decorators';
import AdvancedFacetView from '../src/AdvancedFacetView';
import elasticMockMapping from '../src/AdvancedFacetView/elasticMockMapping';

const PROJECT_ID = 'some_project';
const API_HOST = 'http://localhost:5050';
const ES_HOST = 'http://localhost:9200';

const fetchMapping = () =>
  fetch(`${API_HOST}/${PROJECT_ID}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ES_HOST: ES_HOST, // TODO; get from somewhere
    },
    body: JSON.stringify({
      query: `{
        some_project {
          mapping,
          extended,
        }
      }`,
    }),
  })
    .then(r => r.json())
    .then(({ data }) => {
      return Promise.resolve(data[PROJECT_ID]);
    });

class AdvancedFacetViewLiveStory extends React.Component {
  state = {
    mapping: {},
    extended: {},
  };
  componentDidMount() {
    fetchMapping().then(({ extended, mapping }) =>
      this.setState({ extended, mapping }),
    );
  }
  render() {
    return (
      <AdvancedFacetView
        elasticMapping={this.state.mapping}
        extendedMapping={this.state.extended}
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
