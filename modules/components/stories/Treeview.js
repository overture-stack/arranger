import React from 'react';
import { storiesOf } from '@storybook/react';
import ThemeSwitcher, { AVAILABLE_THEMES } from '../src/ThemeSwitcher';
import NestedTreeView from '../src/NestedTreeView';
import {
  elasticMappingToDisplayTreeData,
  MOCK_MAPPING,
} from './mappingToTreeData';

const dataSource = [
  {
    title: 'Animal',
    isHeader: true,
    children: [
      {
        title: 'Cat',
      },
      {
        title: 'Dog',
        children: [
          {
            title: 'Beagle',
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

storiesOf('Treeview', module).add('Treeview', () => (
  <>
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES} />
    <NestedTreeView
      dataSource={elasticMappingToDisplayTreeData(MOCK_MAPPING)}
    />
    <NestedTreeView dataSource={dataSource} />
  </>
));
