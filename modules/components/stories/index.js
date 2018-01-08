import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import DataTable, { columnConfig, fetchData } from '../src/DataTable'

const tableConfig = columnConfig.files

storiesOf('Button', module)
  .add('with text', () => (
    <button onClick={action('clicked')}>Hello Button</button>
  ))
  .add('with some emoji', () => (
    <button onClick={action('clicked')}>😀 😎 👍 💯</button>
  ))
  .add('Files Table', () => (
    <DataTable
      keyField={tableConfig.keyField}
      columns={tableConfig.columns}
      fetchData={state => fetchData(tableConfig, state)}
    />
  ))
