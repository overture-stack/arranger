import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import './Aggs.css';

import Table from './Table';
import SQONView from '@arranger/components/lib/SQONView';

storiesOf('Portal', module).add('Exploration', () => (
  <div className="app" style={{ display: 'flex' }}>
    <div>aggregations</div>
    <div style={{ flexGrow: 1 }}>
      <SQONView
        sqon={{
          op: 'and',
          content: [],
        }}
      />
      <Table />
    </div>
  </div>
));
