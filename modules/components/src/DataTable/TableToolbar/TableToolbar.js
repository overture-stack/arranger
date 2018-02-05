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
  onFilterChange = () => {},
  page = 0,
  pageSize = 0,
  propsData,
  total = propsData?.total || 0,
  type = '',
  allowTogglingColumns = true,
  allowTSVExport = true,
  customActions = null,
  streamData = () => {},
  style,
}) => (
  <div style={{ padding: 10, display: 'flex', flex: 'none', ...style }}>
    <div style={{ flexGrow: 1 }}>
      Showing {(page * pageSize + 1).toLocaleString()} -{' '}
      {Math.min((page + 1) * pageSize, total).toLocaleString()} {type} of{' '}
      {total?.toLocaleString()}
    </div>
    <input
      type="text"
      placeholder="Filter"
      onChange={e => {
        onFilterChange(e.target.value);
      }}
    />
    {allowTogglingColumns && (
      <DropDown
        itemToString={i => i.Header}
        items={canChangeShowColumns}
        onChange={item => {
          onColumnsChange({ ...item, show: !item.show });
        }}
      >
        Show columns
      </DropDown>
    )}
    {allowTSVExport && (
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
    )}
    {customActions}
  </div>
);

export default enhance(TableToolbar);
