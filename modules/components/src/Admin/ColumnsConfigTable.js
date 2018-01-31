import React from 'react';
import DataTable from '../DataTable';

export default ({ total, data, handleChange, onFilterChange }) => (
  <DataTable
    onFilterChange={onFilterChange}
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
              onChange={() =>
                handleChange({ key: props.column.id, row: props.original })
              }
            />
          </div>
        );
      },
      component: ({ value: Component }) => <Component />,
    }}
    config={{
      timestamp: '2018-01-12T16:42:07.495Z',
      type: 'Columns',
      keyField: 'field',
      defaultSorted: [{ id: 'field', desc: false }],
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
          Header: 'Show',
          type: 'checkbox',
          sortable: true,
          canChangeShow: true,
          accessor: 'show',
        },
        {
          show: true,
          Header: 'Active',
          type: 'checkbox',
          sortable: true,
          canChangeShow: true,
          accessor: 'canChangeShow',
        },
        {
          show: true,
          Header: 'Type',
          type: 'text',
          sortable: true,
          canChangeShow: true,
          accessor: 'type',
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
