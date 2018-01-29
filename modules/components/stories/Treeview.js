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
<<<<<<< HEAD
    <NestedTreeView
      dataSource={elasticMappingToDisplayTreeData(MOCK_MAPPING)}
    />
=======
>>>>>>> 50a9611... adds ThemeSwitcher
    <NestedTreeView dataSource={dataSource} />
  </>
));
