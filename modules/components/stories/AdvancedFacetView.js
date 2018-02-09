import React from 'react';
import { storiesOf } from '@storybook/react';
import { omit } from 'lodash';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import { themeDecorator } from './decorators';
import AdvancedFacetView from '../src/AdvancedFacetView';
import elasticMockMapping from '../src/AdvancedFacetView/elasticMockMapping';
import { replaceSQON, toggleSQON } from '../src/SQONView/utils';
import LiveAdvancedFacetView from '../src/AdvancedFacetView/LiveAdvancedFacetView';
import { action } from '@storybook/addon-actions';

const PROJECT_ID = 'testing1';
const ES_INDEX = 'testing1';
const API_HOST = 'http://localhost:5050';
const ES_HOST = 'http://localhost:9200';
// const ES_HOST = 'http://142.1.177.54:9200';

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
  .add('AdvancedFacetViewLive', () => (
    <LiveAdvancedFacetView
      {...{
        PROJECT_ID,
        ES_INDEX,
        API_HOST,
        ES_HOST,
        onSqonChange: ({ sqon }) => console.log(sqon),
        sqon: {
          op: 'and',
          content: [
            { op: '>=', content: { field: 'age_at_diagnosis', value: 17 } },
            { op: '<=', content: { field: 'age_at_diagnosis', value: 26 } },
          ],
        },
      }}
    />
  ))
  .add('AdvancedFacetView', () => (
    <AdvancedFacetView
      elasticMapping={elasticMockMapping}
      aggregations={mockAggregations}
      extendedMapping={[]}
      sqon={{
        op: 'and',
        content: [
          { op: '>=', content: { field: 'age_at_diagnosis', value: 17 } },
          { op: '<=', content: { field: 'age_at_diagnosis', value: 26 } },
        ],
      }}
    />
  ));
