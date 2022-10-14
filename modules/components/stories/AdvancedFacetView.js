import React from 'react';
import { css } from '@emotion/react';
import { storiesOf } from '@storybook/react';

import LiveAdvancedFacetView from '../src/AdvancedFacetView/LiveAdvancedFacetView';

import { themeDecorator } from './decorators';

const injectMockBuckets = (node) =>
  Object.keys(node).reduce(
    (agg, key) => ({
      ...agg,
      [key]: attachBucketToNode(node[key]),
    }),
    {},
  );

const attachBucketToNode = (mappingNode) => ({
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
        index: process.env['STORYBOOK_AFV_ACTIVE_INDEX'],
        onSqonChange: ({ sqon }) => console.log(sqon),
        sqon: {
          op: 'and',
          content: [
            {
              op: 'in',
              content: {
                fieldName: 'data_type',
                value: ['submitted aligned reads'],
              },
            },
          ],
        },
      }}
    />
  ));
