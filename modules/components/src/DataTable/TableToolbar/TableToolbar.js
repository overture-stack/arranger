import React from 'react';

import DropDown from '../../DropDown';
import { compose, withProps } from 'recompose';
import saveTSV from './saveTSV';

const enhance = compose(
  withProps(({ columns }) => ({
    canChangeShowColumns: columns.filter(column => column.canChangeShow),
  })),
);

const TableToolbar = ({
  columns,
  canChangeShowColumns,
  onColumnsChange,
  onSQONChange,
  page = 0,
  pageSize = 0,
  total = 0,
  type = '',
  streamData = () => {},
}) => (
  <div style={{ padding: 10, display: 'flex' }}>
    <div style={{ flexGrow: 1 }}>
      Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)}{' '}
      {type} of {total}
    </div>
    <input
      type="text"
      placeholder="Filter"
      onChange={e => {
        const value = e.target.value;
        const t = {
          op: 'OR',
          content: columns.filter(c => c.show).map(column => {
            return {
              op: 'IN',
              content: {
                field: column.accessor || column.id,
                value: [value],
              },
            };
          }),
        };
        onSQONChange(t);
      }}
    />
    <DropDown
      itemToString={i => i.Header}
      items={canChangeShowColumns}
      onChange={item => {
        onColumnsChange(
          Object.assign([], columns, {
            [columns.indexOf(item)]: {
              ...item,
              show: !item.show,
            },
          }),
        );
      }}
    >
      Show columns
    </DropDown>
    <div>
      <button
        style={{ display: 'flex', cursor: 'pointer' }}
        onClick={() => {
          saveTSV({ columns: columns.filter(c => c.show), streamData });
        }}
      >
        <div style={{ minHeight: 16 }}>Export TSV</div>
      </button>
    </div>
  </div>
);

export default enhance(TableToolbar);
