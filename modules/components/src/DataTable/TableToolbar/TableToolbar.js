import React from 'react';
import DropDown from '../../DropDown';

export default ({
  columns,
  onColumnsChange,
  page = 0,
  pageSize = 0,
  total = 0,
  type = '',
}) => (
  <div style={{ padding: 10, display: 'flex' }}>
    <div style={{ flexGrow: 1 }}>
      Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)}{' '}
      {type} of {total}
    </div>
    <input type="text" placeholder="Filter" />
    <DropDown
      itemToString={i => i.Header}
      items={columns}
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
      <button style={{ display: 'flex', cursor: 'pointer' }}>
        <div style={{ minHeight: 16 }}>Export TSV</div>
      </button>
    </div>
  </div>
);
