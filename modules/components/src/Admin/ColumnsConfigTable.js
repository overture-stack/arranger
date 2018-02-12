import React from 'react';
import DataTable from '../DataTable';
import { withState } from 'recompose';

const StateInput = withState('edit', 'setEdit', ({ value }) => value)(
  ({ value, edit, setEdit, onChange }) => (
    <>
      <input
        type="text"
        value={edit || ''}
        onChange={e => setEdit(e.target.value)}
      />
      <button disabled={edit === value} onClick={() => onChange(edit)}>
        save
      </button>
    </>
  ),
);
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
      input: props => {
        return (
          <div
            css={`
              text-align: center;
            `}
          >
            <StateInput
              value={props.value}
              onChange={edit =>
                handleChange({
                  key: props.column.id,
                  row: props.original,
                  value: edit,
                })
              }
            />
          </div>
        );
      },
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
          type: 'input',
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
