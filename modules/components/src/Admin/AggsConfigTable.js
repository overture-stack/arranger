import React from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../DataTable';

export default ({ total, data, handleChange }) => (
  <DataTable
    customActions={null}
    allowTogglingColumns={false}
    allowTSVExport={false}
    customTypes={{
      boolean: props => (props.value ? 'Yes' : 'No'),
      checkbox: props => {
        return (
          <div
            css={`
              text-align: center;
            `}
          >
            <input
              type="checkbox"
              checked={props.value}
              onChange={() => handleChange(props.original)}
            />
          </div>
        );
      },
      component: ({ value: Component }) => <Component />,
    }}
    config={{
      timestamp: '2018-01-12T16:42:07.495Z',
      type: 'Aggs',
      keyField: 'id',
      defaultSorted: [{ id: 'id', desc: false }],
      columns: [
        {
          show: true,
          Header: 'Field',
          type: 'text',
          sortable: true,
          canChangeShow: true,
          accessor: 'field',
        },
        {
          show: true,
          Header: 'Agg Type',
          type: 'text',
          sortable: true,
          canChangeShow: true,
          accessor: 'type',
        },
        {
          show: true,
          Header: 'Active',
          type: 'checkbox',
          sortable: true,
          canChangeShow: true,
          accessor: 'active',
        },
      ],
    }}
    data={{
      total,
      data,
    }}
    loading={false}
  />
);
