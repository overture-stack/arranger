import React from 'react';
import { storiesOf } from '@storybook/react';
import NestedTreeView from '../src/NestedTreeView';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import { themeDecorator } from './decorators';

const {
  elasticMappingToDisplayTreeData,
  MOCK_MAPPING,
} = mappingToDisplayTreeData;

const dataSource = [
  {
    title: 'Animal',
    id: 'animal',
    children: [
      {
        title: 'Cat',
        id: 'cat',
      },
      {
        title: 'Dog',
        id: 'dog',
        children: [
          {
            title: 'Beagle',
            id: 'beagle',
            children: [
              {
                title: 'My Beagle',
                id: 'beagle1',
              },
              {
                title: "Alex's Beagle",
                id: 'beagle2',
              },
            ],
          },
          {
            title: 'Pug',
            id: 'pug',
            children: [
              {
                title: 'My Pug',
                id: 'pug1',
              },
              {
                title: "Alex's Pug",
                id: 'pug2',
              },
            ],
          },
        ],
      },
    ],
  },
];

storiesOf('Treeview', module)
  .addDecorator(themeDecorator)
  .add('Treeview', () => (
    <>
      <NestedTreeView
        dataSource={elasticMappingToDisplayTreeData(MOCK_MAPPING)}
      />
      <NestedTreeView dataSource={dataSource} />
    </>
  ));
