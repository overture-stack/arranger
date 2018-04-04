import React from 'react';
import DataTable from '../DataTable';

export default ({ total, data, handleChange, onFilterChange }) => (
  <DataTable
    onFilterChange={onFilterChange}
    customActions={null}
    allowTogglingColumns={false}
    allowTSVExport={false}
    customTypes={{
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
          Header: 'Default',
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
