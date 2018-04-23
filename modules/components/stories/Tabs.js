import React from 'react';
import StoryRouter from 'storybook-router';
import { storiesOf } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';

import Tabs, { TabsTable } from '../src/Tabs';
import { themeDecorator } from './decorators';

storiesOf('Tabs', module)
  .addDecorator(themeDecorator)
  .addDecorator(StoryRouter())
  .add('Tabs', () => (
    <BrowserRouter>
      <Tabs
        tabs={[
          {
            title: <span>Matched (xx)</span>,
            content: (
              <TabsTable
                columns={[
                  {
                    Header: 'Input Id',
                    accessor: 'inputId',
                  },
                  { Header: 'Matched Entity', accessor: 'matchedEntity' },
                  { Header: 'Entity Id', accessor: 'entityId' },
                ]}
                data={[
                  { inputId: 123, matchedEntity: 'Dog', entityId: 'dog123' },
                ]}
              />
            ),
          },
          {
            title: `Unmatched (xx)`,
            content: (
              <TabsTable
                columns={[
                  {
                    Header: 'Input Id',
                    accessor: 'inputId',
                  },
                ]}
                data={[{ inputId: 'abcd' }, { inputId: '123bdal' }]}
              />
            ),
          },
        ]}
      />
    </BrowserRouter>
  ));
