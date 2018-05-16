import React from 'react';
import { css } from 'emotion';
import { storiesOf } from '@storybook/react';
import { themeDecorator } from './decorators';
import LiveAdvancedFacetView from '../src/AdvancedFacetView/LiveAdvancedFacetView';

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

storiesOf('AdvancedFacetView', module)
  .addDecorator(themeDecorator)
  .add('AdvancedFacetViewLive', () => (
    <LiveAdvancedFacetView
      {...{
        statComponent: (
          <div
            className={css`
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 1;
            `}
          >
            (Stat components to be inserted here from portal)
          </div>
        ),
        projectId: process.env['STORYBOOK_AFV_PROJECT_ID'],
        index: process.env['STORYBOOK_AFV_ACTIVE_INDEX'],
        onSqonChange: ({ sqon }) => console.log(sqon),
        sqon: {
          op: 'and',
          content: [
            {
              op: 'in',
              content: {
                field: 'data_type',
                value: ['submitted aligned reads'],
              },
            },
          ],
        },
      }}
    />
  ));
