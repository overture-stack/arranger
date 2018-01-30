import React from 'react';
import { storiesOf } from '@storybook/react';
import ThemeSwitcher, { AVAILABLE_THEMES } from '../src/ThemeSwitcher';
import NestedTreeView from '../src/NestedTreeView';
import {
  elasticMappingToDisplayTreeData,
  MOCK_MAPPING,
} from './mappingToTreeData';
import { themeDecorator } from './decorators';

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
  .addDecorator(story => (
    <div
      style={{
        position: 'absolute',
        left: '0px',
        right: '0px',
        top: '50px',
        bottom: '0px',
      }}
    >
      {story()}
    </div>
  ))
  .add('Treeview', () => (
    <>
      <NestedTreeView
        dataSource={elasticMappingToDisplayTreeData(MOCK_MAPPING)}
      />
      <NestedTreeView dataSource={dataSource} />
    </>
  ));
