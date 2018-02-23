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

const PROJECT_ID = 'feb-23';
const ES_INDEX = 'file';

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
        projectId: PROJECT_ID,
        index: ES_INDEX,
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
