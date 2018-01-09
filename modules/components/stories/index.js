import React from 'react';
import { storiesOf } from '@storybook/react';

import DataTable, { columnConfig, fetchData } from '../src/DataTable';

const tableConfig = columnConfig.files;

storiesOf('Button', module).add('Files Table', () => (
  <DataTable
    config={tableConfig}
    fetchData={state => fetchData(tableConfig, state)}
    onSelectionChange={selection => console.log(selection)}
  />
));
